export interface Booth {
  id: string;
  label: string;
  category?: string;
  /** SVG viewBox coordinate units, not pixels or percentages. */
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
  occupancy: number;
}
