export type SupportedLocale = "ko" | "en" | "es";

export type Dictionary = {
  home: string;
  homeTitle: string;
  homeDescription: string;
  chats: string;
  friends: string;
  settings: string;
  editProfile: string;
  myProfile: string;
  addFriend: string;
  close: string;
  friendEmail: string;
  sendRequest: string;
  pendingRequests: string;
  sentRequests: string;
  friendsList: string;
  incomingRequestsDescription: string;
  sentRequestsDescription: string;
  acceptedFriendsDescription: string;
  noIncomingRequests: string;
  noSentRequests: string;
  noAcceptedFriends: string;
  noIncomingRequestsDescription: string;
  noSentRequestsDescription: string;
  noAcceptedFriendsDescription: string;
  accept: string;
  reject: string;
  opening: string;
  chat: string;
  viewProfile: string;
  darkMode: string;
  logout: string;
  deleteAccount: string;
  accountNotes: string;
  settingsDescription: string;
  send: string;
  read: string;
  unread: string;
  typing: string;
  liveConnected: string;
  reconnecting: string;
  connecting: string;
  sending: string;
  failedToSend: string;
  messageTooLong: string;
  save: string;
  cancel: string;
  login: string;
  signup: string;
  email: string;
  password: string;
  profile: string;
  language: string;
  country: string;
  noMessages: string;
  startConversation: string;
  emptyConversationGreeting: string;
  emptyConversationQuickSend: string;
  originalLabel: string;
  back: string;
  more: string;
  deleteChatHistory: string;
  leaveChatRoom: string;
  deleteChatHistoryConfirm: string;
  leaveChatRoomConfirm: string;
  deleting: string;
  leaving: string;
};

export const messages: Record<SupportedLocale, Dictionary> = {
  en: {
    home: "Home",
    homeTitle: "Your translation hub, simplified.",
    homeDescription:
      "Move between friends, chats, and settings inside one soft glass layout designed for both desktop and mobile.",
    chats: "Chats",
    friends: "Friends",
    settings: "Settings",
    editProfile: "Edit Profile",
    myProfile: "My profile",
    addFriend: "Add Friend",
    close: "Close",
    friendEmail: "Friend email",
    sendRequest: "Send request",
    pendingRequests: "Pending requests",
    sentRequests: "Sent requests",
    friendsList: "Friends list",
    incomingRequestsDescription: "",
    sentRequestsDescription: "",
    acceptedFriendsDescription: "Only accepted relationships appear here.",
    noIncomingRequests: "No incoming requests",
    noSentRequests: "No sent requests",
    noAcceptedFriends: "No accepted friends yet",
    noIncomingRequestsDescription:
      "When someone sends you a friend request, it will appear here with accept and reject actions.",
    noSentRequestsDescription:
      "Send a request by email and it will stay here until the other person accepts or rejects it.",
    noAcceptedFriendsDescription:
      "Accepted requests will move here automatically so both people can be treated as friends across the app.",
    accept: "Accept",
    reject: "Reject",
    opening: "Opening...",
    chat: "Chat",
    viewProfile: "View profile",
    darkMode: "Dark mode",
    logout: "Logout",
    deleteAccount: "Delete account",
    accountNotes: "Account notes",
    settingsDescription: "Account controls and appearance preferences.",
    send: "Send",
    read: "Read",
    unread: "Unread",
    typing: "Typing...",
    liveConnected: "Live updates connected",
    reconnecting: "Reconnecting...",
    connecting: "Connecting...",
    sending: "Sending...",
    failedToSend: "Failed to send",
    messageTooLong: "Your message is too long. Please keep it under 300 characters.",
    save: "Save",
    cancel: "Cancel",
    login: "Login",
    signup: "Sign Up",
    email: "Email",
    password: "Password",
    profile: "Profile",
    language: "Language",
    country: "Country",
    noMessages: "No messages yet",
    startConversation: "Start a conversation",
    emptyConversationGreeting: "Start with a warm hello 😊",
    emptyConversationQuickSend: "Say \"Hello 😊\"",
    originalLabel: "Original",
    back: "Back",
    more: "More",
    deleteChatHistory: "Delete chat history",
    leaveChatRoom: "Leave chat room",
    deleteChatHistoryConfirm: "Delete every message in this chat history?",
    leaveChatRoomConfirm: "Leave this chat room?",
    deleting: "Deleting...",
    leaving: "Leaving..."
  },
  ko: {
    home: "\uD648",
    homeTitle: "\uBC88\uC5ED \uD5C8\uBE0C\uB97C \uB354 \uAC04\uB2E8\uD558\uAC8C.",
    homeDescription:
      "\uBD80\uB4DC\uB7FD\uACE0 \uAE00\uB798\uC2A4 \uAC10\uC131\uC758 \uB808\uC774\uC544\uC6C3 \uC548\uC5D0\uC11C \uCE5C\uAD6C, \uCC44\uD305, \uC124\uC815\uC744 \uB370\uC2A4\uD06C\uD0D1\uACFC \uBAA8\uBC14\uC77C \uBAA8\uB450\uC5D0\uC11C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC624\uAC00\uC138\uC694.",
    chats: "\uCC44\uD305",
    friends: "\uCE5C\uAD6C",
    settings: "\uC124\uC815",
    editProfile: "\uD504\uB85C\uD544 \uC218\uC815",
    myProfile: "\uB0B4 \uD504\uB85C\uD544",
    addFriend: "\uCE5C\uAD6C \uCD94\uAC00",
    close: "\uB2EB\uAE30",
    friendEmail: "\uCE5C\uAD6C \uC774\uBA54\uC77C",
    sendRequest: "\uC694\uCCAD \uBCF4\uB0B4\uAE30",
    pendingRequests: "\uB300\uAE30 \uC911\uC778 \uC694\uCCAD",
    sentRequests: "\uBCF4\uB0B8 \uC694\uCCAD",
    friendsList: "\uCE5C\uAD6C \uBAA9\uB85D",
    incomingRequestsDescription: "",
    sentRequestsDescription: "",
    acceptedFriendsDescription: "\uC218\uB77D\uB41C \uAD00\uACC4\uB9CC \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.",
    noIncomingRequests: "\uBC1B\uC740 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    noSentRequests: "\uBCF4\uB0B8 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4",
    noAcceptedFriends: "\uC544\uC9C1 \uCE5C\uAD6C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4",
    noIncomingRequestsDescription:
      "\uB204\uAD70\uAC00 \uCE5C\uAD6C \uC694\uCCAD\uC744 \uBCF4\uB0B4\uBA74 \uC5EC\uAE30\uC5D0\uC11C \uC218\uB77D \uB610\uB294 \uAC70\uC808\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    noSentRequestsDescription:
      "\uC774\uBA54\uC77C\uB85C \uC694\uCCAD\uC744 \uBCF4\uB0B4\uBA74 \uC0C1\uB300\uAC00 \uC218\uB77D\uD558\uAC70\uB098 \uAC70\uC808\uD560 \uB54C\uAE4C\uC9C0 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.",
    noAcceptedFriendsDescription:
      "\uC218\uB77D\uB41C \uC694\uCCAD\uC740 \uC790\uB3D9\uC73C\uB85C \uC5EC\uAE30\uB85C \uC774\uB3D9\uD558\uC5EC \uC11C\uB85C \uCE5C\uAD6C\uB85C \uCC98\uB9AC\uB429\uB2C8\uB2E4.",
    accept: "\uC218\uB77D",
    reject: "\uAC70\uC808",
    opening: "\uC5EC\uB294 \uC911...",
    chat: "\uCC44\uD305",
    viewProfile: "\uD504\uB85C\uD544 \uBCF4\uAE30",
    darkMode: "\uB2E4\uD06C \uBAA8\uB4DC",
    logout: "\uB85C\uADF8\uC544\uC6C3",
    deleteAccount: "\uACC4\uC815 \uC0AD\uC81C",
    accountNotes: "\uACC4\uC815 \uC548\uB0B4",
    settingsDescription: "\uACC4\uC815 \uAD00\uB9AC\uC640 \uD654\uBA74 \uD45C\uC2DC \uC124\uC815\uC785\uB2C8\uB2E4.",
    send: "\uBCF4\uB0B4\uAE30",
    read: "\uC77D\uC74C",
    unread: "\uC548 \uC77D\uC74C",
    typing: "\uC785\uB825 \uC911...",
    liveConnected: "\uC2E4\uC2DC\uAC04 \uC5F0\uACB0 \uC644\uB8CC",
    reconnecting: "\uB2E4\uC2DC \uC5F0\uACB0 \uC911...",
    connecting: "\uC5F0\uACB0 \uC911...",
    sending: "\uBCF4\uB0B4\uB294 \uC911...",
    failedToSend: "\uC804\uC1A1 \uC2E4\uD328",
    messageTooLong:
      "\uBA54\uC2DC\uC9C0\uAC00 \uB108\uBB34 \uAE38\uC5B4\uC694. 300\uC790 \uC774\uD558\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.",
    save: "\uC800\uC7A5",
    cancel: "\uCDE8\uC18C",
    login: "\uB85C\uADF8\uC778",
    signup: "\uD68C\uC6D0\uAC00\uC785",
    email: "\uC774\uBA54\uC77C",
    password: "\uBE44\uBC00\uBC88\uD638",
    profile: "\uD504\uB85C\uD544",
    language: "\uC5B8\uC5B4",
    country: "\uAD6D\uAC00",
    noMessages: "\uBA54\uC2DC\uC9C0\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4",
    startConversation: "\uB300\uD654\uB97C \uC2DC\uC791\uD574 \uBCF4\uC138\uC694",
    emptyConversationGreeting: "먼저 반갑게 인사해보세요 😊",
    emptyConversationQuickSend: "안녕하세요 😊라고 말하기",
    originalLabel: "\uC6D0\uBB38",
    back: "\uB4A4\uB85C\uAC00\uAE30",
    more: "\uB354\uBCF4\uAE30",
    deleteChatHistory: "\uCC44\uD305 \uAE30\uB85D \uC0AD\uC81C",
    leaveChatRoom: "\uCC44\uD305\uBC29 \uB098\uAC00\uAE30",
    deleteChatHistoryConfirm:
      "\uC774 \uCC44\uD305\uC758 \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694?",
    leaveChatRoomConfirm: "\uC774 \uCC44\uD305\uBC29\uC744 \uB098\uAC00\uC2DC\uACA0\uC5B4\uC694?",
    deleting: "\uC0AD\uC81C \uC911...",
    leaving: "\uB098\uAC00\uB294 \uC911..."
  },
  es: {
    home: "Inicio",
    homeTitle: "Tu centro de traduccion, simplificado.",
    homeDescription:
      "Muevete entre amigos, chats y configuracion dentro de una interfaz de cristal suave pensada para escritorio y movil.",
    chats: "Chats",
    friends: "Amigos",
    settings: "Configuracion",
    editProfile: "Editar perfil",
    myProfile: "Mi perfil",
    addFriend: "Agregar amigo",
    close: "Cerrar",
    friendEmail: "Correo del amigo",
    sendRequest: "Enviar solicitud",
    pendingRequests: "Solicitudes pendientes",
    sentRequests: "Solicitudes enviadas",
    friendsList: "Lista de amigos",
    incomingRequestsDescription: "",
    sentRequestsDescription: "",
    acceptedFriendsDescription: "Solo las relaciones aceptadas aparecen aqui.",
    noIncomingRequests: "No hay solicitudes recibidas",
    noSentRequests: "No hay solicitudes enviadas",
    noAcceptedFriends: "Todavia no hay amigos aceptados",
    noIncomingRequestsDescription:
      "Cuando alguien te envie una solicitud, aparecera aqui con acciones para aceptar o rechazar.",
    noSentRequestsDescription:
      "Envia una solicitud por correo y permanecera aqui hasta que la otra persona la acepte o la rechace.",
    noAcceptedFriendsDescription:
      "Las solicitudes aceptadas se moveran aqui automaticamente para que ambos aparezcan como amigos en la app.",
    accept: "Aceptar",
    reject: "Rechazar",
    opening: "Abriendo...",
    chat: "Chat",
    viewProfile: "Ver perfil",
    darkMode: "Modo oscuro",
    logout: "Cerrar sesion",
    deleteAccount: "Eliminar cuenta",
    accountNotes: "Notas de la cuenta",
    settingsDescription: "Controles de cuenta y preferencias de apariencia.",
    send: "Enviar",
    read: "Leido",
    unread: "No leido",
    typing: "Escribiendo...",
    liveConnected: "Actualizaciones en vivo conectadas",
    reconnecting: "Reconectando...",
    connecting: "Conectando...",
    sending: "Enviando...",
    failedToSend: "No se pudo enviar",
    messageTooLong: "Tu mensaje es demasiado largo. Escríbelo con 300 caracteres o menos.",
    save: "Guardar",
    cancel: "Cancelar",
    login: "Iniciar sesion",
    signup: "Registrarse",
    email: "Correo electronico",
    password: "Contrasena",
    profile: "Perfil",
    language: "Idioma",
    country: "Pais",
    noMessages: "Todavia no hay mensajes",
    startConversation: "Inicia una conversacion",
    emptyConversationGreeting: "Empieza con un saludo amable 😊",
    emptyConversationQuickSend: "Decir \"Hola 😊\"",
    originalLabel: "Original",
    back: "Volver",
    more: "Mas",
    deleteChatHistory: "Eliminar historial del chat",
    leaveChatRoom: "Salir de la sala",
    deleteChatHistoryConfirm: "Eliminar todos los mensajes de este chat?",
    leaveChatRoomConfirm: "Salir de esta sala de chat?",
    deleting: "Eliminando...",
    leaving: "Saliendo..."
  }
};
