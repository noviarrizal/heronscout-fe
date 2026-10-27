import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-3xl font-semibold">HeronScout</h1>
      <p className="mt-4 text-neutral-600">Preview renderer. Demo previews:</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-blue-700 underline">
        <li>
          <Link href="/p/demo-dallas-painter">Dallas painter</Link>
        </li>
        <li>
          <Link href="/p/demo-manchester-decorator">Manchester decorator</Link>
        </li>
      </ul>
    </main>
  );
}
