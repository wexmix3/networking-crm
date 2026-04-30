import { task } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";

interface HunterData {
  email?: string;
  position?: string;
  linkedin_url?: string;
}

interface HunterResponse {
  data?: HunterData;
  errors?: { id: string; details: string }[];
}

export const enrichContact = task({
  id: "enrich-contact",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: { contactId: string; name: string; company: string | null }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hunterApiKey = process.env.HUNTER_API_KEY;

    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    if (!hunterApiKey) throw new Error("HUNTER_API_KEY is not set");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nameParts = payload.name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      api_key: hunterApiKey,
    });
    if (payload.company) params.set("company", payload.company);

    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hunter API error: ${res.status} ${res.statusText} — ${body}`);
    }

    const data: HunterResponse = await res.json();
    console.log("Hunter response found:", !!data.data?.email);

    if (!data.data?.email) {
      await supabase
        .from("crm_contacts")
        .update({ enrichment_status: "not_found" })
        .eq("id", payload.contactId);
      return { found: false };
    }

    const person = data.data;
    const updates: Record<string, string | null> = {
      enrichment_status: "found",
    };

    if (person.email) updates.email = person.email;
    if (person.linkedin_url) updates.linkedin_url = person.linkedin_url;
    if (person.position) updates.role = person.position;

    await supabase
      .from("crm_contacts")
      .update(updates)
      .eq("id", payload.contactId);

    return { found: true, fields: Object.keys(updates).filter((k) => k !== "enrichment_status") };
  },
});
