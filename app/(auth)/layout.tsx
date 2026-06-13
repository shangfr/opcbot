import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Preview } from "@/components/chat/preview";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-screen bg-sidebar">
      <div className="flex w-full flex-col bg-background p-8 xl:w-[600px] xl:shrink-0 xl:rounded-r-2xl xl:border-r xl:border-border/40 md:p-16">
        <Link
          className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          返回首页
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <img src="/logo.jpg" alt="OPC Bot" className="mb-2 size-12 rounded-xl object-cover ring-1 ring-border/50" />
            {children}
          </div>
        </div>
      </div>

      <div className="hidden flex-1 flex-col overflow-hidden pl-12 xl:flex">
        <div className="flex-1 pt-4">
          <Preview />
        </div>
      </div>
    </div>
  );
}
