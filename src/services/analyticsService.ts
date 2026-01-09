import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';

export interface AnalyticsData {
  totalViews: number;
  totalClicks: number;
  uniqueVisitors: number;
  topLinks: Array<{
    linkId: string;
    title: string;
    url: string;
    clicks: number;
  }>;
  dailyStats: Array<{
    date: string;
    views: number;
    clicks: number;
    uniqueVisitors: number;
  }>;
}

export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  period?: 'day' | 'week' | 'month';
}

export class AnalyticsService {
  async getBioPageAnalytics(userId: string, filters: AnalyticsFilters = {}): Promise<AnalyticsData> {
    // Verify user owns the bio page
    const bioPage = await prisma.bioPage.findFirst({
      where: { userId },
      include: {
        links: true
      }
    });

    if (!bioPage) {
      throw new NotFoundError('Bio page not found');
    }

    const { startDate, endDate } = this.getDateRange(filters);

    // Build where clause for analytics events
    const whereClause = {
      bioPageId: bioPage.id,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    // Get total views and clicks
    const [totalViews, totalClicks] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          ...whereClause,
          eventType: 'page_view'
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          ...whereClause,
          eventType: 'link_click'
        }
      })
    ]);

    // Get unique visitors (based on IP hash)
    const uniqueVisitorsResult = await prisma.analyticsEvent.findMany({
      where: whereClause,
      select: {
        visitorIpHash: true
      },
      distinct: ['visitorIpHash']
    });
    const uniqueVisitors = uniqueVisitorsResult.filter((v: any) => v.visitorIpHash).length;

    // Get top links by clicks
    const topLinksData = await prisma.analyticsEvent.groupBy({
      by: ['linkId'],
      where: {
        ...whereClause,
        eventType: 'link_click',
        linkId: { not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Enrich top links with link details
    const topLinks = await Promise.all(
      topLinksData.map(async (item: any) => {
        const link = bioPage.links.find((l: any) => l.id === item.linkId);
        return {
          linkId: item.linkId!,
          title: link?.title || 'Unknown Link',
          url: link?.url || '',
          clicks: item._count.id
        };
      })
    );

    // Get daily stats
    const dailyStats = await this.getDailyStats(bioPage.id, startDate, endDate);

    return {
      totalViews,
      totalClicks,
      uniqueVisitors,
      topLinks,
      dailyStats
    };
  }

  private getDateRange(filters: AnalyticsFilters): { startDate: Date; endDate: Date } {
    const endDate = filters.endDate || new Date();
    let startDate = filters.startDate;

    if (!startDate) {
      // Default to last 30 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  private async getDailyStats(bioPageId: string, startDate: Date, endDate: Date) {
    // Get all events in the date range
    const events = await prisma.analyticsEvent.findMany({
      where: {
        bioPageId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        eventType: true,
        visitorIpHash: true,
        createdAt: true
      }
    });

    // Group events by date
    const dailyData = new Map<string, {
      views: number;
      clicks: number;
      uniqueVisitors: Set<string>;
    }>();

    events.forEach((event: any) => {
      const dateKey = event.createdAt.toISOString().split('T')[0] as string;
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          views: 0,
          clicks: 0,
          uniqueVisitors: new Set()
        });
      }

      const dayData = dailyData.get(dateKey)!;
      
      if (event.eventType === 'page_view') {
        dayData.views++;
      } else if (event.eventType === 'link_click') {
        dayData.clicks++;
      }
      
      dayData.uniqueVisitors.add(event.visitorIpHash);
    });

    // Convert to array format
    const dailyStats: Array<{
      date: string;
      views: number;
      clicks: number;
      uniqueVisitors: number;
    }> = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0] as string;
      const dayData = dailyData.get(dateKey);
      
      dailyStats.push({
        date: dateKey,
        views: dayData?.views || 0,
        clicks: dayData?.clicks || 0,
        uniqueVisitors: dayData?.uniqueVisitors.size || 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyStats;
  }

  async getAnalyticsSummary(userId: string): Promise<{
    last30Days: AnalyticsData;
    last7Days: AnalyticsData;
    today: AnalyticsData;
  }> {
    const now = new Date();
    
    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    
    // Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [last30Days, last7Days, today] = await Promise.all([
      this.getBioPageAnalytics(userId, { startDate: thirtyDaysAgo, endDate: now }),
      this.getBioPageAnalytics(userId, { startDate: sevenDaysAgo, endDate: now }),
      this.getBioPageAnalytics(userId, { startDate: todayStart, endDate: todayEnd })
    ]);

    return {
      last30Days,
      last7Days,
      today
    };
  }
}