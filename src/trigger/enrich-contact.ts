import { task } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";

interface ApolloPhone {
  sanitized_number: string;
}

interface ApolloPerson {
  email?: string;
  linkedin_url?: string;
  title?: string;
  phone_numbers?: ApolloPhone[];
}

interface ApolloResponse {
  person?: ApolloPerson;
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
    const apolloApiKey = process.env.APOLLO_API_KEY;

    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    if (!apolloApiKey) throw new Error("APOLLO_API_KEY is not set");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nameParts = payload.name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || undefined;

    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apolloApiKey,
      },
      body: JSON.stringify({
        api_key: apolloApiKey,
        first_name: firstName,
        last_name: lastName,
        organization_name: payload.company ?? undefined,
        reveal_personal_emails: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Apollo API error: ${res.status} ${res.statusText} — ${body}`);
    }

    const data: ApolloResponse = await res.json();
    console.log("Apollo response person found:", !!data.person);
    const person = data.person;

    if (!person) {
      await supabase
        .from("crm_contacts")
        .update({ enrichment_status: "not_found" })
        .eq("id", payload.contactId);
      return { found: false };
    }

    const updates: Record<string, string | null> = {
      enrichment_status: "found",
    };

    if (person.email) updates.email = person.email;
    if (person.linkedin_url) updates.linkedin_url = person.linkedin_url;
    if (person.title) updates.role = person.title;
    if (person.phone_numbers?.length) {
      updates.phone = person.phone_numbers[0].sanitized_number;
    }

    await supabase
      .from("crm_contacts")
      .update(updates)
      .eq("id", payload.contactId);

    return { found: true, fields: Object.keys(updates).filter((k) => k !== "enrichment_status") };
  },
});
