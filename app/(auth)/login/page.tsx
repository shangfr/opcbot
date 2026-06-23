"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_not_found") {
      toast({ type: "error", description: "该账号未注册，请先注册" });
    } else if (state.status === "wrong_password") {
      toast({ type: "error", description: "密码错误，请重试" });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: state.message || "登录失败，请稍后重试",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: state.message || "提交数据验证失败",
      });
    } else if (state.status === "success") {
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
        欢迎回来
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        登录您的账号以继续
      </p>
      <div className="auth-slide-in w-full" style={{ animationDelay: "0.28s" }}>
        <AuthForm
          action={handleSubmit}
          defaultEmail={email}
          error={state.message}
        >
          <div className="flex flex-col gap-3">
            <SubmitButton isSuccessful={isSuccessful}>登录</SubmitButton>
            <div className="flex items-center justify-between text-[13px]">
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href="/forgot-password"
              >
                忘记密码？
              </Link>
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href="/register"
              >
                注册
              </Link>
            </div>
          </div>
        </AuthForm>
      </div>
    </>
  );
}
