export interface VideoItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  creatorName?: string;
  description?: string;
  durationLabel?: string;
  viewsLabel?: string;
  publishedLabel?: string;
}

export interface VideoGridConfig {
  containerHeight?: number | string;
  gap?: number;
  rowHeight?: number;
  overscanRows?: number;
  minColumnWidth?: number;
  mobileColumns?: number;
  tabletColumns?: number;
  desktopColumns?: number;
  mobileBreakpoint?: number;
  desktopBreakpoint?: number;
  animateCards?: boolean;
}

export interface RecommendationItem extends VideoItem {
  score?: number;
  reasonLabel?: string;
}

export interface RecommendationResponse {
  data?: RecommendationItem[];
  recommendations?: RecommendationItem[];
}

