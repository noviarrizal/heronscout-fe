import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { getPreview } from "@/lib/previews";

export default function PreviewPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: Pick<PageProps<"/p/[slug]">, "params">) {
  const { slug } = await params;
  const spec = await getPreview(slug);
  if (!spec) notFound();
  return <SiteRenderer spec={spec} />;
}
