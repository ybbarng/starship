"use client";

// "보기"를 누른 html·md를 어디에 띄울지 알려 주는 자리(2026-11-17 사용자 요청).
// 선실(Cabin)은 show를 주어 지도 자리(FilePane)에 띄우고, 조종석 결재함은 crewId만 주어 그 승무원 선실로 보낸다.
// 둘 다 없으면 FileButtons가 예전처럼 새 탭으로 연다. 설계: docs/files.md "지도 자리에 띄우기".
import { createContext, type ReactNode, useContext } from "react";

export type FilePaneTarget = {
  /** 지금 화면의 지도 자리에 띄운다(선실) */
  show?: (path: string) => void;
  /** 이 승무원 선실로 가서 띄운다(결재함 서류) */
  crewId?: string;
};

const FilePaneContext = createContext<FilePaneTarget>({});

export function useFilePane(): FilePaneTarget {
  return useContext(FilePaneContext);
}

/** 바깥 자리(show)는 그대로 두고 덧붙인다. 선실 안의 결재 서류가 crewId를 주어도 show가 앞선다. */
export function FilePaneProvider({
  children,
  show,
  crewId,
}: FilePaneTarget & { children: ReactNode }) {
  const outer = useContext(FilePaneContext);
  return (
    <FilePaneContext.Provider
      value={{
        show: show ?? outer.show,
        crewId: crewId ?? outer.crewId,
      }}
    >
      {children}
    </FilePaneContext.Provider>
  );
}
