import type { Metadata } from 'next';
import { ArticleRelationsGovernance } from '@/components/article-relations-governance';

export const metadata: Metadata = {
  title: 'Article Relations & Supersession',
};

export default async function ArticleRelationsGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ articleId?: string }>;
}) {
  const params = await searchParams;
  return (
    <ArticleRelationsGovernance
      initialArticleId={params.articleId ?? ''}
    />
  );
}
