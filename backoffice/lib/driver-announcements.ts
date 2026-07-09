import { createServiceRoleSupabaseClient } from "./supabase";

export type DriverAnnouncement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  published: boolean;
};

function mapRow(row: any): DriverAnnouncement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    published: Boolean(row.published)
  };
}

export async function listDriverAnnouncements(limit = 30): Promise<DriverAnnouncement[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_announcements")
    .select("id,title,content,created_at,published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function listPublishedDriverAnnouncements(limit = 10): Promise<DriverAnnouncement[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_announcements")
    .select("id,title,content,created_at,published")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createDriverAnnouncement(input: {
  title: string;
  content: string;
  published?: boolean;
  createdBy?: string | null;
}) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error("title 不能為空。");
  if (!content) throw new Error("content 不能為空。");

  const supabase = createServiceRoleSupabaseClient();
  const published = input.published ?? true;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("driver_announcements")
    .insert({
      title,
      content,
      published,
      published_at: published ? now : null,
      created_by: input.createdBy ?? null
    })
    .select("id,title,content,created_at,published")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function setAnnouncementPublished(id: string, published: boolean) {
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("driver_announcements")
    .update({ published, published_at: published ? now : null })
    .eq("id", id)
    .select("id,title,content,created_at,published")
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteAnnouncement(id: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("driver_announcements").delete().eq("id", id);
  if (error) throw error;
  return { success: true };
}
