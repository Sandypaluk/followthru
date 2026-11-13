// LinkedInConnector — intentionally NOT implemented.
//
// Research finding (verified against LinkedIn's official developer docs):
// self-serve LinkedIn API access covers only "Sign In with LinkedIn"
// (the authenticated member's own name/headline/photo/email) and
// "Share on LinkedIn" (posting as that member). There is no self-serve
// endpoint for reading another member's messages, listing a member's
// inbox, or searching arbitrary profiles — that functionality sits behind
// partner programs LinkedIn does not grant to individual/portfolio
// applications, and several vendors sell workarounds that automate a
// logged-in browser session, which this project deliberately does not use.
//
// So: this connector exists to keep the architecture honest. It documents
// the shape a real connector would have, so that IF LinkedIn opens
// appropriate access in the future (or this runs inside an org with an
// approved partner integration), a real implementation drops in here
// without touching normalize.js, aiAnalysis.js, or any route — they only
// depend on the normalized message shape, not on Gmail specifically.
//
// What would be required to activate this for real:
//   1. Approved LinkedIn partner access covering member messaging (not
//      currently obtainable via self-serve registration).
//   2. OAuth scopes beyond `profile`/`email`/`w_member_social` — the exact
//      scope depends on which partner program grants access.
//   3. A normalizeLinkedInMessage() analogous to normalize.js, mapping
//      LinkedIn's message resource into the same common schema (source:
//      'linkedin', source_id, thread_id, sender, content, etc.) — omitting
//      fields LinkedIn's API doesn't expose rather than inventing them.

export class LinkedInConnector {
  constructor() {
    throw new Error(
      'LinkedInConnector is not implemented. LinkedIn does not currently offer ' +
      'self-serve API access to member messages — see the comment at the top ' +
      'of this file for what would be required to activate it.'
    );
  }

  // Intended signature: async getMessages({ since, limit }) -> raw LinkedIn message resources
  async getMessages() { throw new Error('Not implemented — no available LinkedIn API access.'); }

  // Intended signature: normalizeMessage(raw) -> common normalized schema (see normalize.js)
  normalizeMessage() { throw new Error('Not implemented — no available LinkedIn API access.'); }

  // Intended signature: async sync() -> runs getMessages + normalizeMessage + persists, mirroring sync.js
  async sync() { throw new Error('Not implemented — no available LinkedIn API access.'); }
}
