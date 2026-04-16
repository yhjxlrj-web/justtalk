import type { SupportedLocale } from "@/lib/i18n/messages";

export type ReviewCopy = {
  title: string;
  button: string;
  placeholder: string;
  success: string;
  alreadyToday: string;
  empty: string;
  loadError: string;
  submitError: string;
  maxLengthError: string;
};

const reviewCopy: Record<SupportedLocale, ReviewCopy> = {
  en: {
    title: "Reviews",
    button: "Submit review",
    placeholder: "Leave a short review.",
    success: "Review submitted.",
    alreadyToday: "You've already written a review for this person today.",
    empty: "No reviews yet. Probably a great person, like you 😊",
    loadError: "We couldn't load reviews right now.",
    submitError: "We couldn't submit your review right now.",
    maxLengthError: "Please keep your review within 80 characters."
  },
  ko: {
    title: "리뷰",
    button: "리뷰 작성",
    placeholder: "짧게 리뷰를 남겨보세요.",
    success: "작성 완료",
    alreadyToday: "오늘은 이미 리뷰를 작성했습니다.",
    empty: "아직 리뷰가 없어요. 하지만 분명 좋은 사람일거에요. 당신처럼요 😊",
    loadError: "지금은 리뷰를 불러오지 못했어요.",
    submitError: "지금은 리뷰를 작성하지 못했어요.",
    maxLengthError: "리뷰는 80자 이하로 입력해 주세요."
  },
  es: {
    title: "Reseñas",
    button: "Enviar reseña",
    placeholder: "Deja una reseña breve.",
    success: "Reseña enviada.",
    alreadyToday: "Hoy ya escribiste una reseña para esta persona.",
    empty: "Aún no hay reseñas. Seguro que es buena persona, como tú 😊",
    loadError: "No pudimos cargar las reseñas ahora mismo.",
    submitError: "No pudimos enviar tu reseña ahora mismo.",
    maxLengthError: "Escribe tu reseña con 80 caracteres o menos."
  }
};

export function getReviewCopy(locale: SupportedLocale): ReviewCopy {
  return reviewCopy[locale];
}
