import { CLASS_BOOK_RECORDS } from "../data/class-books.js";
import { CLASS_ABILITY_CATALOG } from "./class-abilities.js";
import skillCatalog from "../data/skills.json" with { type: "json" };

export { CLASS_BOOK_RECORDS };

const bookById = new Map(CLASS_BOOK_RECORDS.map(book => [book.id, book]));
const skillIds = new Set(skillCatalog.skills.map(skill => skill.id));

export function getClassBook(id) {
  return bookById.get(id) ?? null;
}

export function listClassBooks({ classId, itemType } = {}) {
  return CLASS_BOOK_RECORDS.filter(book =>
    (!classId || book.classId === classId) && (!itemType || book.itemType === itemType));
}

function checkBook(character, bookId, itemType) {
  if (!character || typeof character.classId !== "string") throw new TypeError("Character class is required");
  const book = bookById.get(bookId);
  if (!book || book.itemType !== itemType) return { ok: false, reason: "wrong_item_type" };
  if (book.classId !== character.classId) return { ok: false, reason: "wrong_class" };
  return { ok: true, book };
}

/** Grants proficiency in one skill from the book's class list. The book is kept. */
export function studySkillBook(character, bookId, skillId) {
  const checked = checkBook(character, bookId, "class-skill-book");
  if (!checked.ok) return checked;
  if (!skillIds.has(skillId) || !checked.book.skillOptions.includes(skillId)) return { ok: false, reason: "skill_not_in_book" };
  character.skillProficiencies ??= [];
  if (character.skillProficiencies.includes(skillId)) return { ok: false, reason: "already_proficient" };
  character.skillProficiencies.push(skillId);
  return { ok: true, skillId };
}

/** Records every class ability available at the character's level and subclass. */
export function studyAbilityBook(character, bookId) {
  const checked = checkBook(character, bookId, "class-ability-book");
  if (!checked.ok) return checked;
  const abilities = CLASS_ABILITY_CATALOG.forCharacter(character);
  character.knownAbilityIds ??= [];
  const learned = [];
  for (const ability of abilities) {
    if (!character.knownAbilityIds.includes(ability.id)) {
      character.knownAbilityIds.push(ability.id);
      learned.push(ability.id);
    }
  }
  return learned.length ? { ok: true, learned } : { ok: false, reason: "nothing_to_learn" };
}
