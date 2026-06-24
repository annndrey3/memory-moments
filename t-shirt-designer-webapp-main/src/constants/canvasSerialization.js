// Єдиний список службових полів, які мають пережити збереження/відновлення макета
// (localStorage-автозбереження та крок «Скасувати»). Геометрію, стиль і clipPath
// fabric серіалізує за замовчуванням; тут — прапорці, яких НЕМАЄ в дефолтному toObject:
//  • selectable/evented/hoverCursor — стан блокування шарів (рамка/фон/комірки колажу);
//  • objectCaching/strokeUniform — коректний рендер обрізаних фото та рамок;
//  • perPixelTargetFind — хіт-детект фото колажу по видимій (обрізаній) частині;
//  • excludeFromExport — службові об'єкти, що не йдуть у друк;
//  • mmRole/mmSlot/mmFrameId — ролі шарів (фото/комірка/рамка/фон/підпис).
// Використовується і канвас-сховищем, і історією undo — щоб відновлений макет був
// ідентичний збереженому (інакше колаж «розсипається»: фото без обрізки, чужі кліки).
export const SERIALIZE_PROPS = [
  "selectable",
  "evented",
  "hoverCursor",
  "objectCaching",
  "strokeUniform",
  "excludeFromExport",
  "perPixelTargetFind",
  "mmRole",
  "mmSlot",
  "mmSlotRect",
  "mmFrameId",
  "mmSeed",
];
