import type { SupportedLocale } from "@/lib/i18n/messages";

export type AuthMessages = {
  appTitle: string;
  tagline: string;
  welcomeBack: string;
  createSpace: string;
  loginTitle: string;
  signupTitle: string;
  authDescription: string;
  needAccount: string;
  createOne: string;
  alreadyHaveAccount: string;
  logIn: string;
  marketingTitle: string;
  marketingDescription: string;
  starterNotes: string;
  starterNotesDescription: string;
  emailAddress: string;
  emailPlaceholder: string;
  password: string;
  loginPasswordPlaceholder: string;
  signupPasswordPlaceholder: string;
  passwordHint: string;
  loginInfo: string;
  signupInfo: string;
  loginSubmitting: string;
  loginCta: string;
  signupSubmitting: string;
  signupCta: string;
  localeSectionLabel: string;
  loginEmailRequired: string;
  loginEmailInvalid: string;
  loginPasswordRequired: string;
  loginPasswordShort: string;
  loginInvalidCredentials: string;
  loginUnknownError: string;
  signupEmailRequired: string;
  signupEmailInvalid: string;
  signupPasswordRequired: string;
  signupPasswordShort: string;
  signupExistingAccount: string;
  signupUnknownError: string;
  signupVerificationSent: string;
  setupEyebrow: string;
  setupTitle: string;
  setupDescription: string;
  setupNameLabel: string;
  setupNamePlaceholder: string;
  setupCountryLabel: string;
  setupCountryPlaceholder: string;
  setupLanguageLabel: string;
  setupLanguagePlaceholder: string;
  setupPhotoTitle: string;
  setupPhotoDescription: string;
  setupInfo: string;
  setupSubmitting: string;
  setupCta: string;
  setupNameRequired: string;
  setupCountryRequired: string;
  setupLanguageRequired: string;
  setupPhotoTooLarge: string;
  setupPhotoInvalid: string;
  setupStatusTooLong: string;
  setupStatusTooManyLines: string;
  setupSaveError: string;
  setupMetadataError: string;
  setupParticipantRefreshError: string;
};

export const authMessages: Record<SupportedLocale, AuthMessages> = {
  en: {
    appTitle: "JustTalk",
    tagline: "Just talk, in your language.",
    welcomeBack: "Welcome back",
    createSpace: "Create your space",
    loginTitle: "Sign in to JustTalk.",
    signupTitle: "Create your JustTalk account.",
    authDescription: "Just talk, in your language.",
    needAccount: "Need an account?",
    createOne: "Create one",
    alreadyHaveAccount: "Already have an account?",
    logIn: "Log in",
    marketingTitle: "JustTalk",
    marketingDescription: "Just talk, in your language.",
    starterNotes: "Starter notes",
    starterNotesDescription:
      "Supabase auth, storage, presence, and translation layers are already separated into extendable modules.",
    emailAddress: "Email address",
    emailPlaceholder: "you@company.com",
    password: "Password",
    loginPasswordPlaceholder: "Enter your password",
    signupPasswordPlaceholder: "Create a secure password",
    passwordHint: "Use at least 8 characters.",
    loginInfo: "",
    signupInfo:
      "We'll send a verification email before the account becomes active. After verifying, sign in and we'll take new users to profile setup automatically.",
    loginSubmitting: "Signing in...",
    loginCta: "Login",
    signupSubmitting: "Creating account...",
    signupCta: "Sign Up",
    localeSectionLabel: "Language",
    loginEmailRequired: "Please enter your email address.",
    loginEmailInvalid: "Enter a valid email address.",
    loginPasswordRequired: "Please enter your password.",
    loginPasswordShort: "Your password must be at least 6 characters.",
    loginInvalidCredentials: "That email and password combination didn't match. Please try again.",
    loginUnknownError: "We couldn't sign you in right now. Please try again.",
    signupEmailRequired: "Please enter your email address.",
    signupEmailInvalid: "Enter a valid email address.",
    signupPasswordRequired: "Please create a password.",
    signupPasswordShort: "Use at least 8 characters for a stronger password.",
    signupExistingAccount: "An account with that email already exists. Try logging in instead.",
    signupUnknownError: "We couldn't create your account right now. Please try again.",
    signupVerificationSent:
      "We sent a verification email. Open your inbox, click the verification link, then come back to the login page and sign in.",
    setupEyebrow: "Profile setup",
    setupTitle: "Shape the way your messages travel.",
    setupDescription:
      "Add the essentials once and we'll store them for future room presence, chat personalization, and login routing.",
    setupNameLabel: "Name",
    setupNamePlaceholder: "Avery Kim",
    setupCountryLabel: "Country",
    setupCountryPlaceholder: "Select your country",
    setupLanguageLabel: "Preferred language",
    setupLanguagePlaceholder: "Select your language",
    setupPhotoTitle: "Profile photo",
    setupPhotoDescription:
      "Upload a profile photo to reuse across room presence, profiles, and chat headers.",
    setupInfo:
      "Finish this step to unlock the home screen. We'll save your details, upload your avatar, and mark profile setup as complete.",
    setupSubmitting: "Saving profile...",
    setupCta: "Complete setup",
    setupNameRequired: "Please enter your name.",
    setupCountryRequired: "Please select your country.",
    setupLanguageRequired: "Please select your preferred language.",
    setupPhotoTooLarge: "Profile photos must be 5 MB or smaller.",
    setupPhotoInvalid: "Upload a valid image file for your profile photo.",
    setupStatusTooLong: "Status messages should stay within 80 characters.",
    setupStatusTooManyLines: "Status messages can span up to two short lines.",
    setupSaveError: "We couldn't save your profile just yet. Please try again.",
    setupMetadataError:
      "Your profile was saved, but we couldn't finalize setup status. Please try once more.",
    setupParticipantRefreshError:
      "Your profile was saved, but we couldn't refresh your chat profile settings."
  },
  ko: {
    appTitle: "JustTalk",
    tagline: "그냥 말해, 너의 언어로 소통해.",
    welcomeBack: "다시 오신 것을 환영해요",
    createSpace: "새 계정 만들기",
    loginTitle: "JustTalk에 로그인하세요.",
    signupTitle: "JustTalk 계정을 만들어보세요.",
    authDescription: "그냥 말해, 너의 언어로 소통해.",
    needAccount: "계정이 없나요?",
    createOne: "가입하기",
    alreadyHaveAccount: "이미 계정이 있나요?",
    logIn: "로그인",
    marketingTitle: "JustTalk",
    marketingDescription: "그냥 말해, 너의 언어로 소통해.",
    starterNotes: "시작 안내",
    starterNotesDescription:
      "Supabase 인증, 저장소, 프레즌스, 번역 레이어가 확장 가능한 구조로 정리되어 있어요.",
    emailAddress: "이메일 주소",
    emailPlaceholder: "you@company.com",
    password: "비밀번호",
    loginPasswordPlaceholder: "비밀번호를 입력하세요",
    signupPasswordPlaceholder: "안전한 비밀번호를 만들어주세요",
    passwordHint: "최소 8자 이상을 권장합니다.",
    loginInfo: "",
    signupInfo:
      "계정 생성 후 인증 메일이 전송됩니다. 메일 인증을 마치고 로그인하면 프로필 설정으로 바로 이어집니다.",
    loginSubmitting: "로그인 중...",
    loginCta: "로그인",
    signupSubmitting: "계정 생성 중...",
    signupCta: "회원가입",
    localeSectionLabel: "언어",
    loginEmailRequired: "이메일 주소를 입력해주세요.",
    loginEmailInvalid: "올바른 이메일 주소를 입력해주세요.",
    loginPasswordRequired: "비밀번호를 입력해주세요.",
    loginPasswordShort: "비밀번호는 최소 6자 이상이어야 합니다.",
    loginInvalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다. 다시 확인해주세요.",
    loginUnknownError: "지금은 로그인할 수 없습니다. 잠시 후 다시 시도해주세요.",
    signupEmailRequired: "이메일 주소를 입력해주세요.",
    signupEmailInvalid: "올바른 이메일 주소를 입력해주세요.",
    signupPasswordRequired: "비밀번호를 만들어주세요.",
    signupPasswordShort: "비밀번호는 최소 8자 이상으로 설정해주세요.",
    signupExistingAccount: "이미 가입된 이메일입니다. 로그인으로 진행해주세요.",
    signupUnknownError: "지금은 회원가입을 진행할 수 없습니다. 잠시 후 다시 시도해주세요.",
    signupVerificationSent:
      "인증 메일을 보냈어요. 이메일에서 인증 링크를 눌러 인증을 완료한 뒤, 다시 로그인 페이지로 돌아와 로그인해 주세요.",
    setupEyebrow: "프로필 설정",
    setupTitle: "메시지가 오가는 방식을 정해보세요.",
    setupDescription:
      "한 번만 입력하면 이후 채팅방 입장, 번역 방향, 앱 언어 기준에 자연스럽게 반영됩니다.",
    setupNameLabel: "이름",
    setupNamePlaceholder: "홍길동",
    setupCountryLabel: "국가",
    setupCountryPlaceholder: "국가를 선택하세요",
    setupLanguageLabel: "선호 언어",
    setupLanguagePlaceholder: "언어를 선택하세요",
    setupPhotoTitle: "프로필 사진",
    setupPhotoDescription:
      "프로필 사진을 올리면 채팅 헤더와 프로필 화면에서 같은 이미지를 사용할 수 있어요.",
    setupInfo:
      "이 단계를 마치면 홈 화면으로 이동합니다. 프로필 정보와 사진이 함께 저장됩니다.",
    setupSubmitting: "프로필 저장 중...",
    setupCta: "설정 완료",
    setupNameRequired: "이름을 입력해주세요.",
    setupCountryRequired: "국가를 선택해주세요.",
    setupLanguageRequired: "선호 언어를 선택해주세요.",
    setupPhotoTooLarge: "프로필 사진은 5MB 이하만 업로드할 수 있어요.",
    setupPhotoInvalid: "프로필 사진은 이미지 파일만 업로드할 수 있어요.",
    setupStatusTooLong: "상태메시지는 80자 이내로 입력해주세요.",
    setupStatusTooManyLines: "상태메시지는 최대 2줄까지만 입력할 수 있어요.",
    setupSaveError: "프로필을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
    setupMetadataError:
      "프로필은 저장됐지만 설정 완료 처리에 실패했어요. 한 번 더 시도해주세요.",
    setupParticipantRefreshError:
      "프로필은 저장됐지만 채팅 프로필 정보를 새로고침하지 못했어요."
  },
  es: {
    appTitle: "JustTalk",
    tagline: "Solo habla, comunícate en tu idioma.",
    welcomeBack: "Bienvenido de nuevo",
    createSpace: "Crea tu espacio",
    loginTitle: "Inicia sesión en JustTalk.",
    signupTitle: "Crea tu cuenta de JustTalk.",
    authDescription: "Solo habla, comunícate en tu idioma.",
    needAccount: "No tienes cuenta?",
    createOne: "Registrate",
    alreadyHaveAccount: "Ya tienes una cuenta?",
    logIn: "Inicia sesion",
    marketingTitle: "JustTalk",
    marketingDescription: "Solo habla, comunícate en tu idioma.",
    starterNotes: "Notas iniciales",
    starterNotesDescription:
      "Las capas de autenticacion, almacenamiento, presencia y traduccion ya estan separadas para crecer contigo.",
    emailAddress: "Correo electronico",
    emailPlaceholder: "you@company.com",
    password: "Contrasena",
    loginPasswordPlaceholder: "Ingresa tu contrasena",
    signupPasswordPlaceholder: "Crea una contrasena segura",
    passwordHint: "Usa al menos 8 caracteres.",
    loginInfo: "",
    signupInfo:
      "Enviaremos un correo de verificacion antes de activar la cuenta. Despues podras iniciar sesion y completar tu perfil.",
    loginSubmitting: "Iniciando sesion...",
    loginCta: "Iniciar sesion",
    signupSubmitting: "Creando cuenta...",
    signupCta: "Registrarse",
    localeSectionLabel: "Idioma",
    loginEmailRequired: "Ingresa tu correo electronico.",
    loginEmailInvalid: "Ingresa un correo electronico valido.",
    loginPasswordRequired: "Ingresa tu contrasena.",
    loginPasswordShort: "La contrasena debe tener al menos 6 caracteres.",
    loginInvalidCredentials: "La combinacion de correo y contrasena no coincide. Intentalo de nuevo.",
    loginUnknownError: "No pudimos iniciar sesion ahora mismo. Intentalo otra vez.",
    signupEmailRequired: "Ingresa tu correo electronico.",
    signupEmailInvalid: "Ingresa un correo electronico valido.",
    signupPasswordRequired: "Crea una contrasena.",
    signupPasswordShort: "Usa al menos 8 caracteres para una contrasena mas segura.",
    signupExistingAccount: "Ya existe una cuenta con ese correo. Prueba iniciar sesion.",
    signupUnknownError: "No pudimos crear tu cuenta ahora mismo. Intentalo de nuevo.",
    signupVerificationSent:
      "Te enviamos un correo de verificacion. Abre tu bandeja, toca el enlace de verificacion y luego vuelve a la pagina de inicio de sesion para entrar.",
    setupEyebrow: "Configuracion del perfil",
    setupTitle: "Define como viajaran tus mensajes.",
    setupDescription:
      "Completa lo esencial una sola vez y lo usaremos para presencia, personalizacion y rutas de acceso.",
    setupNameLabel: "Nombre",
    setupNamePlaceholder: "Avery Kim",
    setupCountryLabel: "Pais",
    setupCountryPlaceholder: "Selecciona tu pais",
    setupLanguageLabel: "Idioma preferido",
    setupLanguagePlaceholder: "Selecciona tu idioma",
    setupPhotoTitle: "Foto de perfil",
    setupPhotoDescription:
      "Sube una foto para reutilizarla en presencia de salas, perfiles y encabezados de chat.",
    setupInfo:
      "Completa este paso para entrar a la pantalla principal. Guardaremos tus datos y tu avatar.",
    setupSubmitting: "Guardando perfil...",
    setupCta: "Completar configuracion",
    setupNameRequired: "Ingresa tu nombre.",
    setupCountryRequired: "Selecciona tu pais.",
    setupLanguageRequired: "Selecciona tu idioma preferido.",
    setupPhotoTooLarge: "La foto de perfil debe pesar 5 MB o menos.",
    setupPhotoInvalid: "Sube un archivo de imagen valido para tu foto de perfil.",
    setupStatusTooLong: "El estado debe mantenerse dentro de 80 caracteres.",
    setupStatusTooManyLines: "El estado puede ocupar como maximo dos lineas cortas.",
    setupSaveError: "No pudimos guardar tu perfil todavia. Intentalo de nuevo.",
    setupMetadataError:
      "Tu perfil se guardo, pero no pudimos finalizar el estado de configuracion. Intentalo otra vez.",
    setupParticipantRefreshError:
      "Tu perfil se guardo, pero no pudimos actualizar la configuracion del chat."
  }
};

export function getAuthMessages(locale: SupportedLocale): AuthMessages {
  return authMessages[locale];
}
