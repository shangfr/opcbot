"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: state.message || "该邮箱已被注册" });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: state.message || "创建账号失败",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: state.message || "提交数据验证失败",
      });
    } else if (state.status === "success") {
      toast({ type: "success", description: "账号创建成功" });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1
        className="auth-slide-in text-2xl font-semibold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        创建账号
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        免费注册，立即体验
      </p>
      <div className="auth-slide-in w-full" style={{ animationDelay: "0.28s" }}>
        <AuthForm
          action={handleSubmit}
          defaultEmail={email}
          error={state.message}
        >
          <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>
          <p className="text-center text-[13px] text-muted-foreground">
            {"已有账号？"}
            <Link
              className="text-foreground underline-offset-4 hover:underline"
              href="/login"
            >
              登录
            </Link>
          </p>
        </AuthForm>
      </div>
    </>
  );
}
