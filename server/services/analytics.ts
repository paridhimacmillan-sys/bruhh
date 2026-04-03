import { db } from "../storage";
import { issueEntries, organizations, templates } from "@shared/schema";
import { eq, and, gte, lte, desc, count, sum, sql } from "drizzle-orm";

/**
 * Advanced Analytics Service
 * Works with unified issue_entries and template system
 * Template-aware analytics for manufacturing, bakery, food service, etc.
 */

export interface AnalyticsPeriod {
  from: Date;
  to: Date;
}

export interface OverviewStats {
  totalIssues: number;
  totalQuantity: number;
  avgQuantityPerIssue: number;
  uniqueCategories: number;
  uniqueItems: number;
  uniqueIssueTypes: number;
}

export interface TrendData {
  period: string;
  current: {
    count: number;
    quantity: number;
  };
  previous: {
    count: number;
    quantity: number;
  };
  changePercent: {
    count: number;
    quantity: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TopCategory {
  name: string;
  count: number;
  quantity: number;
  percentage: number;
  topIssueType: string;
}

export interface TopItem {
  name: string;
  count: number;
  quantity: number;
  percentage: number;
  topIssueType: string;
}

export interface TopIssueType {
  name: string;
  count: number;
  quantity: number;
  percentage: number;
  topCategory: string;
  topItem: string;
}

export interface DailyTrend {
  date: string;
  count: number;
  quantity: number;
}

export interface InsightSummary {
  type: 'top_issue' | 'problem_area' | 'trend_change';
  title: string;
  description: string;
  value: string;
  change?: string;
  confidence: number;
}

export interface AnalyticsData {
  overview: OverviewStats;
  trends: {
    last7Days: TrendData;
    last30Days: TrendData;
  };
  topCategories: TopCategory[];
  topItems: TopItem[];
  topIssueTypes: TopIssueType[];
  dailyTrend: DailyTrend[];
  insights: InsightSummary[];
}

export class AnalyticsService {
  
  /**
   * Get comprehensive analytics for organization
   */
  async getAnalytics(organizationId: number, period?: AnalyticsPeriod): Promise<AnalyticsData> {
    const defaultPeriod = this.getDefaultPeriod();
    const analyticsPeriod = period || defaultPeriod;

    const [
      overview,
      last7DaysTrend,
      last30DaysTrend,
      topCategories,
      topItems,
      topIssueTypes,
      dailyTrend,
      insights
    ] = await Promise.all([
      this.getOverviewStats(organizationId, analyticsPeriod),
      this.getTrendData(organizationId, 7),
      this.getTrendData(organizationId, 30),
      this.getTopCategories(organizationId, analyticsPeriod),
      this.getTopItems(organizationId, analyticsPeriod),
      this.getTopIssueTypes(organizationId, analyticsPeriod),
      this.getDailyTrend(organizationId, analyticsPeriod),
      this.generateInsights(organizationId, analyticsPeriod)
    ]);

    return {
      overview,
      trends: {
        last7Days: last7DaysTrend,
        last30Days: last30DaysTrend
      },
      topCategories,
      topItems,
      topIssueTypes,
      dailyTrend,
      insights
    };
  }

  /**
   * Get overview statistics
   */
  private async getOverviewStats(organizationId: number, period: AnalyticsPeriod): Promise<OverviewStats> {
    const baseQuery = db.select({
      count: count(),
      totalQuantity: sum(issueEntries.quantity).mapWith(Number),
      uniqueCategories: sql<string>`COUNT(DISTINCT ${issueEntries.zone})`,
      uniqueItems: sql<string>`COUNT(DISTINCT ${issueEntries.partNumber})`,
      uniqueIssueTypes: sql<string>`COUNT(DISTINCT ${issueEntries.type})`
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .limit(1);

    const result = await baseQuery;
    const stats = result[0];

    return {
      totalIssues: stats.count || 0,
      totalQuantity: stats.totalQuantity || 0,
      avgQuantityPerIssue: stats.count > 0 ? (stats.totalQuantity || 0) / stats.count : 0,
      uniqueCategories: parseInt(stats.uniqueCategories || '0'),
      uniqueItems: parseInt(stats.uniqueItems || '0'),
      uniqueIssueTypes: parseInt(stats.uniqueIssueTypes || '0')
    };
  }

  /**
   * Get trend data comparing current vs previous period
   */
  private async getTrendData(organizationId: number, days: number): Promise<TrendData> {
    const now = new Date();
    const currentFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousTo = currentFrom;
    const previousFrom = new Date(previousTo.getTime() - days * 24 * 60 * 60 * 1000);

    const [currentData, previousData] = await Promise.all([
      this.getPeriodStats(organizationId, currentFrom, now),
      this.getPeriodStats(organizationId, previousFrom, previousTo)
    ]);

    const countChange = previousData.count > 0 
      ? ((currentData.count - previousData.count) / previousData.count) * 100 
      : 0;

    const quantityChange = previousData.quantity > 0 
      ? ((currentData.quantity - previousData.quantity) / previousData.quantity) * 100 
      : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(countChange) > 10) {
      trend = countChange > 0 ? 'increasing' : 'decreasing';
    }

    return {
      period: `Last ${days} days`,
      current: currentData,
      previous: previousData,
      changePercent: {
        count: countChange,
        quantity: quantityChange
      },
      trend
    };
  }

  /**
   * Get stats for a specific period
   */
  private async getPeriodStats(organizationId: number, from: Date, to: Date) {
    const result = await db.select({
      count: count(),
      quantity: sum(issueEntries.quantity).mapWith(Number)
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, from),
      lte(issueEntries.date, to)
    ))
    .limit(1);

    return {
      count: result[0]?.count || 0,
      quantity: result[0]?.quantity || 0
    };
  }

  /**
   * Get top categories/zones/stations
   */
  private async getTopCategories(organizationId: number, period: AnalyticsPeriod): Promise<TopCategory[]> {
    const totalResult = await db.select({ count: count() })
      .from(issueEntries)
      .where(and(
        eq(issueEntries.organizationId, organizationId),
        gte(issueEntries.date, period.from),
        lte(issueEntries.date, period.to)
      ))
      .limit(1);

    const total = totalResult[0]?.count || 0;

    const categories = await db.select({
      name: issueEntries.zone,
      count: count(),
      quantity: sum(issueEntries.quantity).mapWith(Number)
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(issueEntries.zone)
    .orderBy(desc(count()))
    .limit(10);

    const result: TopCategory[] = [];

    for (const category of categories) {
      // Get top issue type for this category
      const topIssueType = await db.select({ type: issueEntries.type })
        .from(issueEntries)
        .where(and(
          eq(issueEntries.organizationId, organizationId),
          eq(issueEntries.zone, category.name),
          gte(issueEntries.date, period.from),
          lte(issueEntries.date, period.to)
        ))
        .groupBy(issueEntries.type)
        .orderBy(desc(count()))
        .limit(1);

      result.push({
        name: category.name,
        count: category.count,
        quantity: category.quantity,
        percentage: total > 0 ? (category.count / total) * 100 : 0,
        topIssueType: topIssueType[0]?.type || 'Unknown'
      });
    }

    return result;
  }

  /**
   * Get top items/products/batches
   */
  private async getTopItems(organizationId: number, period: AnalyticsPeriod): Promise<TopItem[]> {
    const totalResult = await db.select({ count: count() })
      .from(issueEntries)
      .where(and(
        eq(issueEntries.organizationId, organizationId),
        gte(issueEntries.date, period.from),
        lte(issueEntries.date, period.to)
      ))
      .limit(1);

    const total = totalResult[0]?.count || 0;

    const items = await db.select({
      name: issueEntries.partNumber,
      count: count(),
      quantity: sum(issueEntries.quantity).mapWith(Number)
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(issueEntries.partNumber)
    .orderBy(desc(count()))
    .limit(10);

    const result: TopItem[] = [];

    for (const item of items) {
      // Get top issue type for this item
      const topIssueType = await db.select({ type: issueEntries.type })
        .from(issueEntries)
        .where(and(
          eq(issueEntries.organizationId, organizationId),
          eq(issueEntries.partNumber, item.name),
          gte(issueEntries.date, period.from),
          lte(issueEntries.date, period.to)
        ))
        .groupBy(issueEntries.type)
        .orderBy(desc(count()))
        .limit(1);

      result.push({
        name: item.name,
        count: item.count,
        quantity: item.quantity,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
        topIssueType: topIssueType[0]?.type || 'Unknown'
      });
    }

    return result;
  }

  /**
   * Get top issue types
   */
  private async getTopIssueTypes(organizationId: number, period: AnalyticsPeriod): Promise<TopIssueType[]> {
    const totalResult = await db.select({ count: count() })
      .from(issueEntries)
      .where(and(
        eq(issueEntries.organizationId, organizationId),
        gte(issueEntries.date, period.from),
        lte(issueEntries.date, period.to)
      ))
      .limit(1);

    const total = totalResult[0]?.count || 0;

    const issueTypes = await db.select({
      name: issueEntries.type,
      count: count(),
      quantity: sum(issueEntries.quantity).mapWith(Number)
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(issueEntries.type)
    .orderBy(desc(count()))
    .limit(10);

    const result: TopIssueType[] = [];

    for (const issueType of issueTypes) {
      // Get top category and item for this issue type
      const [topCategory, topItem] = await Promise.all([
        db.select({ zone: issueEntries.zone })
          .from(issueEntries)
          .where(and(
            eq(issueEntries.organizationId, organizationId),
            eq(issueEntries.type, issueType.name),
            gte(issueEntries.date, period.from),
            lte(issueEntries.date, period.to)
          ))
          .groupBy(issueEntries.zone)
          .orderBy(desc(count()))
          .limit(1),
        db.select({ partNumber: issueEntries.partNumber })
          .from(issueEntries)
          .where(and(
            eq(issueEntries.organizationId, organizationId),
            eq(issueEntries.type, issueType.name),
            gte(issueEntries.date, period.from),
            lte(issueEntries.date, period.to)
          ))
          .groupBy(issueEntries.partNumber)
          .orderBy(desc(count()))
          .limit(1)
      ]);

      result.push({
        name: issueType.name,
        count: issueType.count,
        quantity: issueType.quantity,
        percentage: total > 0 ? (issueType.count / total) * 100 : 0,
        topCategory: topCategory[0]?.zone || 'Unknown',
        topItem: topItem[0]?.partNumber || 'Unknown'
      });
    }

    return result;
  }

  /**
   * Get daily trend data
   */
  private async getDailyTrend(organizationId: number, period: AnalyticsPeriod): Promise<DailyTrend[]> {
    const entries = await db.select({
      date: sql<string>`DATE(${issueEntries.date})`,
      count: count(),
      quantity: sum(issueEntries.quantity).mapWith(Number)
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(sql`DATE(${issueEntries.date})`)
    .orderBy(sql`DATE(${issueEntries.date})`);

    return entries.map(entry => ({
      date: entry.date,
      count: entry.count,
      quantity: entry.quantity
    }));
  }

  /**
   * Generate insight summaries
   */
  private async generateInsights(organizationId: number, period: AnalyticsPeriod): Promise<InsightSummary[]> {
    const insights: InsightSummary[] = [];

    // Get top issue type
    const topIssueType = await db.select({
      type: issueEntries.type,
      count: count()
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(issueEntries.type)
    .orderBy(desc(count()))
    .limit(1);

    if (topIssueType.length > 0) {
      insights.push({
        type: 'top_issue',
        title: 'Most Common Issue',
        description: `This week's most frequent problem`,
        value: topIssueType[0].type,
        confidence: 0.9
      });
    }

    // Get biggest problem area
    const topCategory = await db.select({
      zone: issueEntries.zone,
      count: count()
    })
    .from(issueEntries)
    .where(and(
      eq(issueEntries.organizationId, organizationId),
      gte(issueEntries.date, period.from),
      lte(issueEntries.date, period.to)
    ))
    .groupBy(issueEntries.zone)
    .orderBy(desc(count()))
    .limit(1);

    if (topCategory.length > 0) {
      insights.push({
        type: 'problem_area',
        title: 'Biggest Problem Area',
        description: 'Area requiring immediate attention',
        value: topCategory[0].zone,
        confidence: 0.85
      });
    }

    // Get trend change
    const trend7Days = await this.getTrendData(organizationId, 7);
    if (trend7Days.trend !== 'stable') {
      insights.push({
        type: 'trend_change',
        title: 'Significant Trend Change',
        description: `Issues ${trend7Days.trend} compared to last week`,
        value: `${trend7Days.changePercent.count.toFixed(1)}%`,
        change: trend7Days.trend === 'increasing' ? '↑' : '↓',
        confidence: 0.8
      });
    }

    return insights;
  }

  /**
   * Get default period (last 30 days)
   */
  private getDefaultPeriod(): AnalyticsPeriod {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to: now };
  }

  /**
   * Get template-aware field labels
   */
  async getFieldLabels(organizationId: number) {
    // Get organization's template configuration
    const org = await db.select().from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org[0]) {
      return this.getDefaultLabels();
    }

    // For now, return default labels
    // In a real implementation, this would check the applied template
    return this.getDefaultLabels();
  }

  private getDefaultLabels() {
    return {
      zone: 'Zone',
      partNumber: 'Part Number',
      type: 'Issue Type',
      quantity: 'Quantity'
    };
  }
}
