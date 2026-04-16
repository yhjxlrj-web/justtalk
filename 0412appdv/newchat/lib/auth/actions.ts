"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  DeleteAccountFormState,
  LoginFormState,
  SignupFormState
} from "@/lib/auth/action-state";
import { getPostLoginRedirectPath } from "@/lib/auth/profile";
import { getAuthMessages } from "@/lib/i18n/auth-messages";
import { resolveAuthLocale } from "@/lib/i18n/auth-locale";
import { setServerAuthLocale } from "@/lib/i18n/auth-locale-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseActionClient } from "@/lib/supabase/server";

function validateLoginForm(email: string, password: string, locale: string): LoginFormState["errors"] {
  const auth = getAuthMessages(resolveAuthLocale(locale));
  const errors: LoginFormState["errors"] = {};

  if (!email.trim()) {
    errors.email = auth.loginEmailRequired;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = auth.loginEmailInvalid;
  }

  if (!password) {
    errors.password = auth.loginPasswordRequired;
  } else if (password.length < 6) {
    errors.password = auth.loginPasswordShort;
  }

  return errors;
}

function validateSignupForm(email: string, password: string, locale: string): SignupFormState["errors"] {
  const auth = getAuthMessages(resolveAuthLocale(locale));
  const errors: SignupFormState["errors"] = {};

  if (!email.trim()) {
    errors.email = auth.signupEmailRequired;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = auth.signupEmailInvalid;
  }

  if (!password) {
    errors.password = auth.signupPasswordRequired;
  } else if (password.length < 8) {
    errors.password = auth.signupPasswordShort;
  }

  return errors;
}

async function getAuthRedirectUrl() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const forwardedProto = headerStore.get("x-forwarded-proto") ?? "https";
  const host = headerStore.get("host");

  if (origin) {
    return `${origin}/login`;
  }

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}/login`;
  }

  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}/login`;
  }

  return "http://localhost:3000/login";
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = resolveAuthLocale(String(formData.get("locale") ?? ""));
  const auth = getAuthMessages(locale);

  const errors = validateLoginForm(email, password, locale);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await setServerAuthLocale(locale);

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    return {
      errors: {
        form:
          error?.message === "Invalid login credentials"
            ? auth.loginInvalidCredentials
            : error?.message ?? auth.loginUnknownError
      }
    };
  }

  const redirectPath = await getPostLoginRedirectPath(supabase, data.user);
  return {
    errors: {},
    redirectTo: redirectPath
  };
}

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = resolveAuthLocale(String(formData.get("locale") ?? ""));
  const auth = getAuthMessages(locale);

  const errors = validateSignupForm(email, password, locale);

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await setServerAuthLocale(locale);

  const supabase = await createSupabaseActionClient();
  const emailRedirectTo = `${await getAuthRedirectUrl()}?lang=${locale}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        profile_completed: false,
        setup_completed: false
      }
    }
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("already registered") || message.includes("already been registered")) {
      return {
        errors: {
          form: auth.signupExistingAccount
        }
      };
    }

    if (message.includes("password")) {
      return {
        errors: {
          password: auth.signupPasswordShort
        }
      };
    }

    return {
      errors: {
        form: error.message || auth.signupUnknownError
      }
    };
  }

  const identities = data.user?.identities ?? [];
  const existingAccount = data.user && identities.length === 0;

  if (existingAccount) {
    return {
      errors: {
        form: auth.signupExistingAccount
      }
    };
  }

  return {
    errors: {},
    status: {
      kind: "success",
      message: auth.signupVerificationSent
    }
  };
}

export async function logoutAction() {
  const supabase = await createSupabaseActionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function deleteAccountAction(
  _prevState: DeleteAccountFormState,
  formData: FormData
): Promise<DeleteAccountFormState> {
  const locale = resolveAuthLocale(String(formData.get("locale") ?? ""));
  const auth = getAuthMessages(locale);
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const acknowledge = String(formData.get("acknowledge") ?? "") === "on";

  if (!acknowledge) {
    return {
      error:
        locale === "ko"
          ? "이 작업이 영구적이라는 점을 확인해주세요."
          : locale === "es"
            ? "Confirma que entiendes que esta accion es permanente."
            : "Please confirm that you understand this action is permanent."
    };
  }

  if (confirmation !== "DELETE") {
    return {
      error:
        locale === "ko"
          ? '"DELETE"를 정확히 입력해 계정 삭제를 확인해주세요.'
          : locale === "es"
            ? 'Escribe "DELETE" exactamente para confirmar la eliminacion.'
            : 'Type "DELETE" exactly to confirm account deletion.'
    };
  }

  const supabase = await createSupabaseActionClient();
  const authResponse = await supabase.auth.getUser();
  const user = authResponse.data?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  const admin = createSupabaseAdminClient();

  await supabase.from("profiles").delete().eq("id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return {
      error:
        error.message ??
        (locale === "ko"
          ? "지금은 계정을 삭제할 수 없습니다. 잠시 후 다시 시도하거나 지원팀에 문의해주세요."
          : locale === "es"
            ? "No pudimos eliminar tu cuenta ahora mismo. Intentalo de nuevo o contacta soporte."
            : "We couldn't delete your account right now. Please try again or contact support.")
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}
