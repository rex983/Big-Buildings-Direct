import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    // Check if user is a customer
    if (session.user.roleName === "Customer") {
      redirect("/portal");
    }
    redirect("/dashboard");
  }

  redirect("/login");
}
