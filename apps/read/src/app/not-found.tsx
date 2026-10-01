import Link from "next/link";
import { buttonClass } from "@zugaa/ui";

export const metadata = { title: "Олдсонгүй" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-page space-y-6 px-4 py-20">
      <p className="text-sm text-muted">404</p>
      <h1 className="font-serif text-3xl">Хуудас олдсонгүй</h1>
      <p className="text-muted">Энэ хуудас устсан, нийтлэлээс буусан эсвэл хаяг буруу байна.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary", "md")}>
          Нүүр хуудас
        </Link>
        <Link href="/library" className={buttonClass("secondary", "md")}>
          Номын сан
        </Link>
      </div>
    </main>
  );
}
