"use client";

import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";

// 자동 sync와 버튼이 같은 키를 써서, 어느 쪽이 돌든 버튼이 진행 중 상태를 본다.
// 서버에 동시 실행 가드가 없어 두 sync가 겹치면 기본키 충돌이 날 수 있다.
const SYNC_MUTATION_KEY = ["sync"];

// 자동 sync는 페이지를 열 때마다 돌아서, 새로 가져온 게 없으면 성공 토스트를 띄우지 않는다.
export function useSync({ quietWhenUnchanged = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SYNC_MUTATION_KEY,
    mutationFn: api.sync,
    onSuccess: async (summary) => {
      const unchanged = summary.newEvents === 0 && summary.newApiCalls === 0;
      if (!(quietWhenUnchanged && unchanged)) {
        toast.success(
          `새 이벤트 ${summary.newEvents}개, API 호출 ${summary.newApiCalls}개를 가져왔습니다`,
        );
      }
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Sync에 실패했습니다: ${error.message}`);
    },
  });
}

export function useIsSyncing(): boolean {
  return useIsMutating({ mutationKey: SYNC_MUTATION_KEY }) > 0;
}
