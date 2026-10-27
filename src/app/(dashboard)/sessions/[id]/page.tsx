import {
  SessionDetailSkeleton,
  SessionDetailView,
} from "@/components/session/SessionDetailView";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "세션 상세 · tokentrail" };

type SessionParams = PageProps<"/sessions/[id]">["params"];

async function SessionContent({ params }: { params: SessionParams }) {
  const { id } = await params;
  return <SessionDetailView id={id} />;
}

// cacheComponents에서는 generateStaticParams가 없는 params가 요청 시점 값이라 Suspense 안에서 await한다.
export default function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  return (
    <Suspense fallback={<SessionDetailSkeleton />}>
      <SessionContent params={params} />
    </Suspense>
  );
}
