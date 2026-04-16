import type { UserProfile } from "@/types/profile";

export type ProfileSetupFormState = {
  errors: {
    name?: string;
    statusMessage?: string;
    country?: string;
    language?: string;
    photo?: string;
    form?: string;
  };
  profile?: UserProfile;
};

export const initialProfileSetupFormState: ProfileSetupFormState = {
  errors: {}
};

export const initialEditProfileFormState: ProfileSetupFormState = {
  errors: {}
};
