import prisma from '../config/database';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errors';
import { SubscriptionService } from './subscriptionService';
import { validateUrl } from '../utils/validation';
import { BioPage, BioPageUpdate } from '../types';

export class BioPageService {
  private subscriptionService = new SubscriptionService();
  async createBioPage(userId: string): Promise<BioPage> {
    // Check if user already has a bio page
    const existingBioPage = await prisma.bioPage.findUnique({
      where: { userId }
    });

    if (existingBioPage) {
      throw new ValidationError('User already has a bio page', 'userId');
    }

    // Create bio page with default theme
    const bioPage = await prisma.bioPage.create({
      data: {
        userId,
        themeId: 'default'
      },
      include: {
        links: {
          orderBy: { orderIndex: 'asc' }
        },
        theme: true,
        user: {
          select: {
            username: true,
            profileName: true,
            profileBio: true,
            profileImageUrl: true
          }
        }
      }
    });

    return this.formatBioPage(bioPage);
  }

  async getBioPageByUserId(userId: string): Promise<BioPage | null> {
    const bioPage = await prisma.bioPage.findUnique({
      where: { userId },
      include: {
        links: {
          orderBy: { orderIndex: 'asc' }
        },
        theme: true,
        user: {
          select: {
            username: true,
            profileName: true,
            profileBio: true,
            profileImageUrl: true
          }
        }
      }
    });

    if (!bioPage) {
      return null;
    }

    return this.formatBioPage(bioPage);
  }

  async getBioPageByUsername(username: string): Promise<BioPage | null> {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        bioPage: {
          include: {
            links: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' }
            },
            theme: true
          }
        }
      }
    });

    if (!user || !user.bioPage) {
      return null;
    }

    const bioPageData = {
      ...user.bioPage,
      user: {
        username: user.username,
        profileName: user.profileName,
        profileBio: user.profileBio,
        profileImageUrl: user.profileImageUrl
      }
    };

    return this.formatBioPage(bioPageData);
  }

  async updateBioPage(userId: string, updates: BioPageUpdate): Promise<BioPage> {
    // Validate theme exists if provided
    if (updates.themeId) {
      const theme = await prisma.theme.findUnique({
        where: { id: updates.themeId }
      });

      if (!theme) {
        throw new ValidationError('Theme not found', 'themeId');
      }

      // Check if user has premium access for premium themes
      if (theme.isPremium) {
        const hasAccess = await this.subscriptionService.hasFeatureAccess(userId, 'premium_themes');
        if (!hasAccess) {
          throw new AuthorizationError('Premium subscription required for this theme');
        }
      }
    }

    // Validate custom colors if provided
    if (updates.customColors) {
      // Custom colors are a premium feature
      const hasAccess = await this.subscriptionService.hasFeatureAccess(userId, 'custom_colors');
      if (!hasAccess) {
        throw new AuthorizationError('Premium subscription required for custom colors');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.themeId !== undefined) updateData.themeId = updates.themeId;
    if (updates.isPublished !== undefined) updateData.isPublished = updates.isPublished;
    if (updates.customColors !== undefined) {
      updateData.customColors = updates.customColors ? JSON.stringify(updates.customColors) : null;
    }

    const bioPage = await prisma.bioPage.update({
      where: { userId },
      data: updateData,
      include: {
        links: {
          orderBy: { orderIndex: 'asc' }
        },
        theme: true,
        user: {
          select: {
            username: true,
            profileName: true,
            profileBio: true,
            profileImageUrl: true
          }
        }
      }
    });

    return this.formatBioPage(bioPage);
  }

  async addLink(userId: string, linkData: { title: string; url: string; iconName?: string }): Promise<BioPage> {
    const { title, url, iconName } = linkData;

    // Get bio page first to check current link count
    const bioPage = await prisma.bioPage.findUnique({
      where: { userId },
      include: { links: true }
    });

    if (!bioPage) {
      throw new NotFoundError('Bio page not found');
    }

    // Check link limits for free users
    const hasUnlimitedLinks = await this.subscriptionService.hasFeatureAccess(userId, 'unlimited_links');
    if (!hasUnlimitedLinks && bioPage.links.length >= 5) {
      throw new AuthorizationError('Free accounts are limited to 5 links. Upgrade to Pro for unlimited links.');
    }

    // Validate input
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Link title is required', 'title');
    }

    if (title.length > 100) {
      throw new ValidationError('Link title must be less than 100 characters', 'title');
    }

    if (!url || !validateUrl(url)) {
      throw new ValidationError('Valid URL is required', 'url');
    }

    // Calculate next order index
    const maxOrder = bioPage.links.reduce((max, link) => Math.max(max, link.orderIndex), 0);

    // Create link
    await prisma.link.create({
      data: {
        bioPageId: bioPage.id,
        title: title.trim(),
        url,
        iconName: iconName || null,
        orderIndex: maxOrder + 1
      }
    });

    // Return updated bio page
    return this.getBioPageByUserId(userId) as Promise<BioPage>;
  }

  async updateLink(userId: string, linkId: string, updates: { title?: string; url?: string; iconName?: string; isActive?: boolean }): Promise<BioPage> {
    // Validate input
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new ValidationError('Link title is required', 'title');
      }
      if (updates.title.length > 100) {
        throw new ValidationError('Link title must be less than 100 characters', 'title');
      }
    }

    if (updates.url !== undefined && (!updates.url || !validateUrl(updates.url))) {
      throw new ValidationError('Valid URL is required', 'url');
    }

    // Check if link belongs to user
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        bioPage: { userId }
      }
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // Update link
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title.trim();
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.iconName !== undefined) updateData.iconName = updates.iconName || null;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await prisma.link.update({
      where: { id: linkId },
      data: updateData
    });

    // Return updated bio page
    return this.getBioPageByUserId(userId) as Promise<BioPage>;
  }

  async deleteLink(userId: string, linkId: string): Promise<BioPage> {
    // Check if link belongs to user
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        bioPage: { userId }
      }
    });

    if (!link) {
      throw new NotFoundError('Link not found');
    }

    // Delete link
    await prisma.link.delete({
      where: { id: linkId }
    });

    // Return updated bio page
    return this.getBioPageByUserId(userId) as Promise<BioPage>;
  }

  async reorderLinks(userId: string, linkIds: string[]): Promise<BioPage> {
    // Get bio page and verify all links belong to user
    const bioPage = await prisma.bioPage.findUnique({
      where: { userId },
      include: { links: true }
    });

    if (!bioPage) {
      throw new NotFoundError('Bio page not found');
    }

    // Verify all provided link IDs exist and belong to this bio page
    const existingLinkIds = bioPage.links.map(link => link.id);
    const invalidLinkIds = linkIds.filter(id => !existingLinkIds.includes(id));

    if (invalidLinkIds.length > 0) {
      throw new ValidationError('Invalid link IDs provided', 'linkIds');
    }

    // Update order indices
    const updatePromises = linkIds.map((linkId, index) =>
      prisma.link.update({
        where: { id: linkId },
        data: { orderIndex: index + 1 }
      })
    );

    await Promise.all(updatePromises);

    // Return updated bio page
    return this.getBioPageByUserId(userId) as Promise<BioPage>;
  }

  private formatBioPage(bioPageData: any): BioPage {
    // Parse custom colors if they exist
    let customColors = null;
    if (bioPageData.customColors) {
      try {
        customColors = JSON.parse(bioPageData.customColors);
      } catch (error) {
        console.error('Failed to parse custom colors:', error);
      }
    }

    return {
      id: bioPageData.id,
      userId: bioPageData.userId,
      username: bioPageData.user?.username || '',
      profileName: bioPageData.user?.profileName || '',
      profileBio: bioPageData.user?.profileBio || '',
      profileImageUrl: bioPageData.user?.profileImageUrl || null,
      themeId: bioPageData.themeId,
      customColors,
      links: bioPageData.links.map((link: any) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        iconName: link.iconName,
        isActive: link.isActive,
        order: link.orderIndex
      })),
      isPublished: bioPageData.isPublished,
      createdAt: bioPageData.createdAt,
      updatedAt: bioPageData.updatedAt
    };
  }
}