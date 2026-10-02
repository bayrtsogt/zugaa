import { buttonClass } from "@zugaa/ui";
import { setFollow } from "@/app/actions/follow";

/** Follow toggle (server action; works without JavaScript). */
export function FollowButton({
  storyId,
  following,
  path,
  className,
}: {
  storyId: string;
  following: boolean;
  path: string;
  className?: string;
}) {
  return (
    <form action={setFollow} className={className}>
      <input type="hidden" name="story_id" value={storyId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="follow" value={following ? "0" : "1"} />
      <button type="submit" aria-pressed={following} className={buttonClass(following ? "quiet" : "secondary", "md", "w-full")}>
        {following ? "✓ Дагаж байна" : "Дагах · шинэ бүлгийг мэдэгдэнэ"}
      </button>
    </form>
  );
}
