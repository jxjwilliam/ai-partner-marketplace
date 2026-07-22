import { redirect } from "next/navigation";
import PostForm from "@/components/PostForm";
import { getSessionUser } from "@/lib/auth/session";

export default async function NewPostPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/posts/new");
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
      <PostForm defaultCity={user.city ?? ""} />
    </main>
  );
}
