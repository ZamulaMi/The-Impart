export interface Article {
  id: string;
  // Українська версія (основна)
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  coverImage?: string;
  date: string;
  readTime?: string;
  createdAt?: string;
  published: boolean; // Опубліковано для української версії сайту

  // Англійська версія
  titleEn?: string;
  excerptEn?: string;
  contentEn?: string;
  categoryEn?: string;
  publishedEn?: boolean; // Опубліковано для англійської версії сайту
}

export type SiteLanguage = 'ua' | 'en';

export interface SocialLinksSet {
  telegram?: string;
  instagram?: string;
  x?: string;
  youtube?: string;
  threads?: string;
}

export interface SiteSocialLinks {
  ua: SocialLinksSet;
  en: SocialLinksSet;
}
