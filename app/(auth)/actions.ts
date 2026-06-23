"use server";

import { compare } from "bcrypt-ts";
import { z } from "zod";

import { DUMMY_PASSWORD } from "@/lib/constants";
import { createUser, getUser } from "@/lib/db/queries";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少需要 6 个字符"),
});

export type LoginActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "user_not_found"
    | "wrong_password";
  message?: string;
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    // 先查用户是否存在，区分"用户不存在"和"密码错误"
    // 使用 dummy password 做 timing-safe 比较，防止邮箱枚举
    const users = await getUser(validatedData.email);

    if (users.length === 0) {
      await compare(validatedData.password, DUMMY_PASSWORD);
      return { status: "user_not_found" };
    }

    const [user] = users;

    if (!user.password) {
      await compare(validatedData.password, DUMMY_PASSWORD);
      return { status: "user_not_found" };
    }

    const passwordsMatch = await compare(validatedData.password, user.password);

    if (!passwordsMatch) {
      return { status: "wrong_password" };
    }

    // 凭证正确，调用 signIn 创建 session
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        status: "invalid_data",
        message: firstError?.message ?? "提交数据验证失败",
      };
    }

    return { status: "failed", message: "登录失败，请稍后重试" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
  message?: string;
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists", message: "该邮箱已被注册" };
    }

    await createUser(validatedData.email, validatedData.password);

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        status: "invalid_data",
        message: firstError?.message ?? "提交数据验证失败",
      };
    }

    return { status: "failed", message: "注册失败，请稍后重试" };
  }
};
