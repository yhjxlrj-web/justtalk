import type { SupportedLocale } from "@/lib/i18n/messages";

export type UiCopy = {
  hero: {
    friendsTitle: string;
    friendsDescription: string;
    chatsTitle: string;
    chatsDescription: string;
    settingsTitle: string;
    settingsDescription: string;
    refreshing: string;
  };
  profile: {
    completeProfile: string;
    statusPlaceholder: string;
    statusEmpty: string;
    countryPending: string;
    languagePending: string;
  };
  addFriend: {
    description: string;
    helper: string;
    emailPlaceholder: string;
  };
  settings: {
    developerAdminEmpty: string;
    developerAdminTab: string;
    developerSettingsTab: string;
    developerUnblockAction: string;
    developerUnblockError: string;
    lastSeenVisibilityTitle: string;
    lastSeenVisibilityDescription: string;
    lastSeenVisibilityError: string;
    visibilityOn: string;
    visibilityOff: string;
    themeTitle: string;
    themeDescription: string;
    themeSoftDescription: string;
    themeDarkDescription: string;
    themeLightDescription: string;
    logoutDescription: string;
    deleteDescription: string;
    deleteAcknowledge: string;
    deleteConfirmLabel: string;
    deleteConfirmPlaceholder: string;
    accountNotesTitle: string;
    accountNoteItems: [string, string, string];
  };
  friendList: {
    communityTab: string;
    communityTitle: string;
    communityDescription: string;
    communityNotificationsTitle: string;
    communityNotificationsEmpty: string;
    communityHeartReceived: string;
    communityHeartSendError: string;
    communityHeartAlreadySent: string;
    communityHeartSent: string;
    communityChatAction: string;
    communityRequestAction: string;
    communityRequestAccepted: string;
    communityRequestSent: string;
    communityRequestReceived: string;
    communityHeartAction: string;
    noCommunityUsers: string;
    noCommunityUsersDescription: string;
    recentSeenUnknown: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    blockedTitle: string;
    blockedDescription: string;
    noBlockedUsers: string;
    noBlockedUsersDescription: string;
    deleteAction: string;
    blockAction: string;
    unblockAction: string;
    blockConfirm: string;
    removeError: string;
    blockError: string;
    unblockError: string;
  };
  editProfile: {
    subtitle: string;
    photoTitle: string;
    photoDescription: string;
    viewPhoto: string;
    attachPhoto: string;
    nameLabel: string;
    namePlaceholder: string;
    statusLabel: string;
    statusPlaceholder: string;
    statusHint: string;
    languageLabel: string;
    languagePlaceholder: string;
    countryLabel: string;
    countryPlaceholder: string;
    saving: string;
    closeAria: string;
    closePanelAria: string;
    photoMenuAria: string;
    avatarPreviewAria: string;
  };
};

export const uiCopy: Record<SupportedLocale, UiCopy> = {
  en: {
    hero: {
      friendsTitle: "Friends",
      friendsDescription: "Find people waiting for you in the community.",
      chatsTitle: "Chats",
      chatsDescription: "Just talk, in your language.",
      settingsTitle: "Settings",
      settingsDescription: "",
      refreshing: "Updating"
    },
    profile: {
      completeProfile: "Complete your profile",
      statusPlaceholder: "Set a status message",
      statusEmpty: "No status message.",
      countryPending: "Country pending",
      languagePending: "Language pending"
    },
    addFriend: {
      description: "",
      helper:
        "We'll look up the profile by email, block self-adds and duplicates, and create a pending request.",
      emailPlaceholder: "friend@example.com"
    },
    settings: {
      developerAdminEmpty: "No block history right now.",
      developerAdminTab: "Admin",
      developerSettingsTab: "Settings",
      developerUnblockAction: "Unblock",
      developerUnblockError: "We couldn't remove this block entry right now.",
      lastSeenVisibilityTitle: "Show last seen",
      lastSeenVisibilityDescription: "Choose whether other people can see your recent activity.",
      lastSeenVisibilityError: "We couldn't update your last seen visibility right now.",
      visibilityOn: "On",
      visibilityOff: "Off",
      themeTitle: "Theme",
      themeDescription: "Change the feel of the app whenever you need to.",
      themeSoftDescription: "Clean and simple for everyday use.",
      themeDarkDescription: "Muted night contrast for calmer late-session reading.",
      themeLightDescription: "A crisp, bright theme with cool tones and clear contrast.",
      logoutDescription:
        "Sign out safely from this device while keeping your profile and chat history intact.",
      deleteDescription:
        "This deletes your JustTalk account along with your friends list and chat history. This can't be undone.",
      deleteAcknowledge: "I understand this will permanently remove my account access.",
      deleteConfirmLabel: 'Type "DELETE" to confirm',
      deleteConfirmPlaceholder: "DELETE",
      accountNotesTitle: "Need help?",
      accountNoteItems: [
        "If you need help with the app, feel free to reach out to the developer by email.",
        "yhjxlrj@gmail.com",
        ""
      ]
    },
    friendList: {
      communityTab: "Community",
      communityTitle: "Community",
      communityDescription: "Meet new people and start the conversation.",
      communityNotificationsTitle: "Community alerts",
      communityNotificationsEmpty: "Hearts you receive will show up here.",
      communityHeartReceived: "{name} sent you a heart.",
      communityHeartSendError: "We couldn't send this heart right now.",
      communityHeartAlreadySent: "You've already sent a heart.",
      communityHeartSent: "Heart sent",
      communityChatAction: "Chat",
      communityRequestAction: "Request",
      communityRequestAccepted: "Friends",
      communityRequestSent: "Requested",
      communityRequestReceived: "Request received",
      communityHeartAction: "Heart",
      noCommunityUsers: "No community profiles yet",
      noCommunityUsersDescription: "New profiles will show up here as more people join.",
      recentSeenUnknown: "Recent activity unavailable",
      justNow: "Seen just now",
      minutesAgo: "{count}m ago",
      hoursAgo: "{count}h ago",
      blockedTitle: "Blocked users",
      blockedDescription: "",
      noBlockedUsers: "No blocked users",
      noBlockedUsersDescription: "People you block will appear here so you can manage them later.",
      deleteAction: "Delete",
      blockAction: "Block",
      unblockAction: "Unblock",
      blockConfirm: "Block this user?",
      removeError: "We couldn't remove this friend right now.",
      blockError: "We couldn't block this user right now.",
      unblockError: "We couldn't unblock this user right now."
    },
    editProfile: {
      subtitle: "Refresh the way your profile appears across the app.",
      photoTitle: "Photo",
      photoDescription: "Tap the avatar to preview the current photo or attach a new one.",
      viewPhoto: "View photo",
      attachPhoto: "Attach photo",
      nameLabel: "Name",
      namePlaceholder: "Your name",
      statusLabel: "Status message",
      statusPlaceholder: "Add a short status message",
      statusHint: "Keep it short and readable at a glance.",
      languageLabel: "Language",
      languagePlaceholder: "Select your language",
      countryLabel: "Country",
      countryPlaceholder: "Select your country",
      saving: "Saving...",
      closeAria: "Close profile editor",
      closePanelAria: "Close edit profile panel",
      photoMenuAria: "Photo actions",
      avatarPreviewAria: "Close avatar preview"
    }
  },
  ko: {
    hero: {
      friendsTitle: "친구",
      friendsDescription: "지금 커뮤니티에서 당신을 기다리는 사람을 찾아보세요.",
      chatsTitle: "대화",
      chatsDescription: "그냥 말해, 너의 언어로 소통해.",
      settingsTitle: "설정",
      settingsDescription: "",
      refreshing: "업데이트 중"
    },
    profile: {
      completeProfile: "프로필을 완성해보세요",
      statusPlaceholder: "상태메세지를 설정해보세요",
      statusEmpty: "상태메세지가 없습니다",
      countryPending: "국가 미설정",
      languagePending: "언어 미설정"
    },
    addFriend: {
      description: "",
      helper:
        "이메일로 프로필을 찾고, 자기 자신 추가와 중복 요청을 막은 뒤 대기 중인 요청을 만들어요.",
      emailPlaceholder: "friend@example.com"
    },
    settings: {
      developerAdminEmpty: "현재 차단 내역이 없습니다.",
      developerAdminTab: "관리창",
      developerSettingsTab: "설정창",
      developerUnblockAction: "차단해제",
      developerUnblockError: "지금은 이 차단 내역을 해제할 수 없어요.",
      lastSeenVisibilityTitle: "접속시간 공개",
      lastSeenVisibilityDescription: "다른 사람이 내 최근 접속시간을 볼 수 있을지 설정해보세요.",
      lastSeenVisibilityError: "접속시간 공개 설정을 지금 저장하지 못했어요.",
      visibilityOn: "켜짐",
      visibilityOff: "꺼짐",
      themeTitle: "테마",
      themeDescription: "필요에 따라 앱 전체의 분위기를 바꿔보세요",
      themeSoftDescription: "깔끔하고 편안한 기본 테마",
      themeDarkDescription: "늦은 시간에도 편안하게 볼 수 있는 차분한 다크 테마입니다.",
      themeLightDescription: "맑고 시원한 톤으로 깔끔하게 보이는 테마입니다.",
      logoutDescription:
        "현재 기기에서만 안전하게 로그아웃하고 프로필과 대화기록은 그대로 유지합니다.",
      deleteDescription:
        "모든 친구목록과 대화기록이 삭제되며 JustTalk 계정을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
      deleteAcknowledge: "이 작업은 계정 접근을 영구적으로 삭제한다는 점을 이해했습니다.",
      deleteConfirmLabel: '"DELETE"를 입력해 확인',
      deleteConfirmPlaceholder: "DELETE",
      accountNotesTitle: "개발자 문의",
      accountNoteItems: [
        "앱 관련 문의는 아래 이메일로 편하게 연락해주세요.",
        "yhjxlrj@gmail.com",
        ""
      ]
    },
    friendList: {
      communityTab: "커뮤니티",
      communityTitle: "커뮤니티",
      communityDescription: "새로운 사람들을 만나고 먼저 소통해보세요.",
      communityNotificationsTitle: "커뮤니티 알림",
      communityNotificationsEmpty: "받은 하트 알림이 여기에 표시됩니다.",
      communityHeartReceived: "{name}님이 하트를 보냈어요.",
      communityHeartSendError: "하트를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
      communityHeartAlreadySent: "이미 하트를 보냈습니다.",
      communityHeartSent: "하트 보냈음",
      communityChatAction: "채팅",
      communityRequestAction: "친구요청",
      communityRequestAccepted: "이미 친구",
      communityRequestSent: "요청됨",
      communityRequestReceived: "받은 요청",
      communityHeartAction: "하트",
      noCommunityUsers: "아직 커뮤니티 프로필이 없어요",
      noCommunityUsersDescription: "새로운 사용자가 가입하면 여기에 표시됩니다.",
      recentSeenUnknown: "최근 접속 정보 없음",
      justNow: "방금 접속",
      minutesAgo: "{count}분 전",
      hoursAgo: "{count}시간 전",
      blockedTitle: "차단한 목록",
      blockedDescription: "",
      noBlockedUsers: "차단한 사용자가 없습니다",
      noBlockedUsersDescription: "차단한 사람은 여기에서 다시 관리할 수 있어요.",
      deleteAction: "삭제",
      blockAction: "차단",
      unblockAction: "차단 해제",
      blockConfirm: "이 사용자를 차단할까요?",
      removeError: "지금은 친구를 삭제할 수 없어요.",
      blockError: "지금은 이 사용자를 차단할 수 없어요.",
      unblockError: "지금은 차단을 해제할 수 없어요."
    },
    editProfile: {
      subtitle: "앱 전체에서 보이는 프로필 정보를 자연스럽게 다듬어보세요.",
      photoTitle: "사진",
      photoDescription: "아바타를 눌러 현재 사진을 보거나 새 사진을 첨부할 수 있어요.",
      viewPhoto: "사진 보기",
      attachPhoto: "사진 첨부",
      nameLabel: "이름",
      namePlaceholder: "이름을 입력하세요",
      statusLabel: "상태메세지",
      statusPlaceholder: "짧은 상태메세지를 입력하세요",
      statusHint: "짧고 한눈에 읽기 쉽게 적어보세요.",
      languageLabel: "언어",
      languagePlaceholder: "언어를 선택하세요",
      countryLabel: "국가",
      countryPlaceholder: "국가를 선택하세요",
      saving: "저장 중...",
      closeAria: "프로필 편집 닫기",
      closePanelAria: "프로필 편집 패널 닫기",
      photoMenuAria: "사진 작업",
      avatarPreviewAria: "아바타 미리보기 닫기"
    }
  },
  es: {
    hero: {
      friendsTitle: "Amigos",
      friendsDescription: "Encuentra personas que te esperan en la comunidad.",
      chatsTitle: "Chats",
      chatsDescription: "Solo habla, comunícate en tu idioma.",
      settingsTitle: "Configuración",
      settingsDescription: "",
      refreshing: "Actualizando"
    },
    profile: {
      completeProfile: "Completa tu perfil",
      statusPlaceholder: "Configura un mensaje de estado",
      statusEmpty: "No hay mensaje de estado.",
      countryPending: "País pendiente",
      languagePending: "Idioma pendiente"
    },
    addFriend: {
      description: "",
      helper:
        "Buscaremos el perfil por correo, bloquearemos duplicados y crearemos una solicitud pendiente.",
      emailPlaceholder: "friend@example.com"
    },
    settings: {
      developerAdminEmpty: "No hay bloqueos guardados por ahora.",
      developerAdminTab: "Admin",
      developerSettingsTab: "Ajustes",
      developerUnblockAction: "Desbloquear",
      developerUnblockError: "No pudimos quitar este bloqueo ahora mismo.",
      lastSeenVisibilityTitle: "Mostrar última conexión",
      lastSeenVisibilityDescription: "Elige si otras personas pueden ver tu actividad reciente.",
      lastSeenVisibilityError: "No pudimos guardar esta configuración ahora mismo.",
      visibilityOn: "Sí",
      visibilityOff: "No",
      themeTitle: "Tema",
      themeDescription: "Cambia el ambiente general de la app cuando lo necesites.",
      themeSoftDescription: "Tema limpio y cómodo para el uso diario",
      themeDarkDescription: "Contraste nocturno más calmado para sesiones tardías.",
      themeLightDescription: "Un tema claro y fresco con tonos fríos y una superficie nítida.",
      logoutDescription:
        "Cierra sesión de forma segura en este dispositivo sin borrar tu perfil ni tu historial.",
      deleteDescription:
        "Esto elimina tu cuenta de JustTalk junto con tu lista de amigos y tu historial de chats. Esta acción no se puede deshacer.",
      deleteAcknowledge: "Entiendo que esto eliminará permanentemente el acceso a mi cuenta.",
      deleteConfirmLabel: 'Escribe "DELETE" para confirmar',
      deleteConfirmPlaceholder: "DELETE",
      accountNotesTitle: "Contacto del desarrollador",
      accountNoteItems: [
        "Si necesitas ayuda con la app, puedes escribirle al desarrollador en cualquier momento.",
        "yhjxlrj@gmail.com",
        ""
      ]
    },
    friendList: {
      communityTab: "Comunidad",
      communityTitle: "Comunidad",
      communityDescription: "Conoce a nuevas personas y empieza la conversación.",
      communityNotificationsTitle: "Alertas de la comunidad",
      communityNotificationsEmpty: "Los corazones que recibas aparecerán aquí.",
      communityHeartReceived: "{name} te envió un corazón.",
      communityHeartSendError: "No pudimos enviar este corazón ahora mismo.",
      communityHeartAlreadySent: "Ya enviaste un corazón.",
      communityHeartSent: "Corazón enviado",
      communityChatAction: "Chat",
      communityRequestAction: "Solicitar",
      communityRequestAccepted: "Amigos",
      communityRequestSent: "Solicitado",
      communityRequestReceived: "Solicitud recibida",
      communityHeartAction: "Corazón",
      noCommunityUsers: "Aún no hay perfiles en la comunidad",
      noCommunityUsersDescription: "Los nuevos perfiles aparecerán aquí a medida que más personas se unan.",
      recentSeenUnknown: "Sin información reciente",
      justNow: "Visto ahora",
      minutesAgo: "Hace {count} min",
      hoursAgo: "Hace {count} h",
      blockedTitle: "Usuarios bloqueados",
      blockedDescription: "",
      noBlockedUsers: "No hay usuarios bloqueados",
      noBlockedUsersDescription: "Las personas que bloquees aparecerán aquí para gestionarlas después.",
      deleteAction: "Eliminar",
      blockAction: "Bloquear",
      unblockAction: "Desbloquear",
      blockConfirm: "¿Bloquear a este usuario?",
      removeError: "No pudimos eliminar a este amigo ahora.",
      blockError: "No pudimos bloquear a este usuario ahora.",
      unblockError: "No pudimos desbloquear a este usuario ahora."
    },
    editProfile: {
      subtitle: "Ajusta la forma en que tu perfil aparece en toda la app.",
      photoTitle: "Foto",
      photoDescription: "Toca el avatar para ver la foto actual o adjuntar una nueva.",
      viewPhoto: "Ver foto",
      attachPhoto: "Adjuntar foto",
      nameLabel: "Nombre",
      namePlaceholder: "Ingresa tu nombre",
      statusLabel: "Mensaje de estado",
      statusPlaceholder: "Escribe un mensaje breve",
      statusHint: "Mantenlo corto y fácil de leer de un vistazo.",
      languageLabel: "Idioma",
      languagePlaceholder: "Selecciona tu idioma",
      countryLabel: "País",
      countryPlaceholder: "Selecciona tu país",
      saving: "Guardando...",
      closeAria: "Cerrar editor de perfil",
      closePanelAria: "Cerrar panel de perfil",
      photoMenuAria: "Acciones de foto",
      avatarPreviewAria: "Cerrar vista previa del avatar"
    }
  }
};

export function getUiCopy(locale: SupportedLocale): UiCopy {
  return uiCopy[locale];
}
