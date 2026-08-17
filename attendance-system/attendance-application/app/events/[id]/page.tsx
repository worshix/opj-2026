import EventDetailView from "@/components/event-detail";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailView eventId={id} />;
}
