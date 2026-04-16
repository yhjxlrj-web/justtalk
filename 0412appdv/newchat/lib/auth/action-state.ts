export type LoginFormState = {
  errors: {
    email?: string;
    password?: string;
    form?: string;
  };
  redirectTo?: string;
};

export const initialLoginFormState: LoginFormState = {
  errors: {}
};

export type SignupFormState = {
  errors: {
    email?: string;
    password?: string;
    form?: string;
  };
  status?: {
    kind: "success" | "info";
    message: string;
  };
};

export const initialSignupFormState: SignupFormState = {
  errors: {}
};

export type DeleteAccountFormState = {
  error?: string;
};

export const initialDeleteAccountFormState: DeleteAccountFormState = {};
