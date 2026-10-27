import type { Metadata } from "next";

// Previews use real businesses' names and reviews, so they must never be indexed.
export const metadata: Metadata = {
  title: "Website preview",
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewLayout({ children }: LayoutProps<"/p">) {
  return children;
}
