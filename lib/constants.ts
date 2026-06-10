// クラス・グループ定義（DBのclass_id 1〜5 に対応）
export const CLASSES = [
  { id: 1, label: "みずほさんクラス",   slots: 3 },
  { id: 2, label: "あっこさんクラス",   slots: 4 },
  { id: 3, label: "やまひでさんクラス", slots: 4 },
  { id: 4, label: "みやさんクラス",     slots: 4 },
  { id: 5, label: "テスト",             slots: 1 },
];

export const classLabel = (id: number | null) =>
  CLASSES.find((c) => c.id === id)?.label ?? `クラス${id}`;
