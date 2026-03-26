import AuthedImg from "@/components/AuthedImg.jsx";

export type TreeChipPerson = {
  id?: string;
  sex?: string;
  isSelf?: boolean;
  firstName?: string;
  lastName?: string;
  photo?: string;
  photoUrl?: string;
};

export function sx(p: TreeChipPerson | null | undefined): string {
  return p?.sex === "M" ? "m" : p?.sex === "F" ? "f" : "u";
}

export function ini(p: TreeChipPerson | null | undefined): string {
  const f = (p?.firstName || "?")[0];
  const l = (p?.lastName || "")[0] || "";
  return (f + l).toUpperCase().slice(0, 2);
}

export function Av({ p, size = 36 }: { p: TreeChipPerson; size?: number }) {
  const s = sx(p);
  const photo = p?.photo || p?.photoUrl;
  return (
    <div
      className={`tree-av ${s}${p?.isSelf ? " self" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {photo ? (
        <AuthedImg src={photo} alt="" className="tree-av-img" />
      ) : (
        ini(p)
      )}
      <div className="tree-av-ring" />
    </div>
  );
}
