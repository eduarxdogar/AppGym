
export interface ChartDataPoint {
  label: string;
  value: number;
  date?: Date;
}

export interface StatsData {
  total: number;
  max: number;
  avg: number;
  count: number;
  chartData: ChartDataPoint[]; // For Line Chart
}

export interface PieDataPoint {
  label: string;
  value: number;
}
