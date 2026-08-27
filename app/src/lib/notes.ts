// Operator notes -- doc 02 section 13 "OPERATOR NOTES": "Allow operators
// to leave notes on a case, visible to other operators, timestamped and
// attributed to the author." Backed by the existing Note model (already
// in the Prisma schema since P0-2); this is the first code that actually
// reads/writes it.
//
// Same pure-validation/thin-DB-wrapper split as everywhere else in this
// codebase.

import type { PrismaClient } from "@prisma/client";

export class EmptyNoteError extends Error {
  constructor() {
    super("Note content cannot be empty");
    this.name = "EmptyNoteError";
  }
}

/**
 * Pure: doc 02 section 13 doesn't say anything fancy needs to happen to
 * a note's content, but an empty note is never useful and is worth
 * rejecting explicitly rather than silently storing a blank row.
 */
export function validateNoteContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new EmptyNoteError();
  }
  return trimmed;
}

export interface CreateNoteInput {
  claimantId: string;
  authorId: string;
  content: string;
}

export async function createNote(db: PrismaClient, input: CreateNoteInput) {
  const content = validateNoteContent(input.content);
  return db.note.create({
    data: {
      claimantId: input.claimantId,
      authorId: input.authorId,
      content,
    },
  });
}

export interface NoteView {
  id: string;
  content: string;
  authorName: string;
  createdAt: Date;
}

/**
 * Fetches every note on a claimant's case, newest first, with the
 * author's name already joined -- so the UI never has to make a
 * second round trip per note.
 */
export async function fetchNotesForClaimant(db: PrismaClient, claimantId: string): Promise<NoteView[]> {
  const rows = await db.note.findMany({
    where: { claimantId },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    authorName: row.author.name,
    createdAt: row.createdAt,
  }));
}
