import type { Metadata } from "next";
import { contactEmail } from "@/lib/contact";

export const metadata: Metadata = { title: "Мэдээлэл устгах" };

export default function DataDeletionPage() {
  const email = contactEmail();
  return (
    <article className="prose-read space-y-4 pb-8 text-base">
      <h1 className="font-display text-3xl font-bold tracking-tight">Мэдээлэл устгах заавар</h1>
      <p>Та Зугаа дахь бүртгэл болон түүнтэй холбоотой бүх мэдээллээ (уншсан түүх, худалдан авалт, профайл) устгуулж болно.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          {email ? (
            <>
              <a href={`mailto:${email}?subject=${encodeURIComponent("Бүртгэл устгах хүсэлт")}`}>{email}</a> хаяг руу
            </>
          ) : (
            "Манай Facebook хуудас руу"
          )}{" "}
          «Бүртгэл устгах хүсэлт» гэж бичиж, бүртгэлтэй имэйл хаяг эсвэл ашигласан Facebook нэрээ хавсаргана уу.
        </li>
        <li>Бид 7 хоногийн дотор бүртгэлийг тань бүх мэдээллийн хамт устгаж, хариу мэдэгдэнэ.</li>
        <li>
          Facebook-ээр нэвтэрсэн бол Facebook → Тохиргоо → Апп ба вэбсайт хэсгээс «Зугаа»-г хасаж, бидний хандах эрхийг
          цуцалж болно.
        </li>
      </ol>
      <p className="text-sm text-muted">Хуулийн дагуу хадгалах шаардлагатай төлбөрийн бүртгэл (дүн, огноо) нэргүй хэлбэрээр үлдэж болно.</p>
    </article>
  );
}
