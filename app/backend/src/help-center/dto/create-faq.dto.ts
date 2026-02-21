export class CreateFaqDto {
  title: string;
  content: string;
  categoryId: string;
  relatedArticleIds?: string[];
}
