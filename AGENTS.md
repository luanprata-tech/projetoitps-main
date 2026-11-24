<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Use the shared project form for creation and overview editing; save only overview fields so goals, tracking records, and costs remain unchanged.
- Apply project-table to tables and date-cell to date columns; shared styles provide zebra shading, middle vertical alignment, right-aligned text and centered dates.
- Store active and completed semesters separately; derive progress through goalProgress so inactive semesters never affect the percentage.
- Use independent items in one multiple accordion for work-plan sections so they share width and can remain open together.
- Use MoneyCell for monetary table cells and fixed colgroups for compact tracking/cost columns; this preserves localized amounts and leaves remaining width to free text.
- Keep goal status references stable while editing labels and semantic colors in the shared status catalog; removal atomically reassigns affected goals so no dangling status remains.
