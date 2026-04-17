import React, { useCallback } from "react";
import ProfileCard from "../vendor/react-bits/ProfileCard/ProfileCard.jsx";
import "../vendor/react-bits/ProfileCard/ProfileCardRelatives.css";

function strId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function fmtNameFirstLast(p) {
  return [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || "Без имени";
}

function initials(p) {
  const f = (p?.firstName || "?")[0] || "?";
  const l = (p?.lastName || "")[0] || "";
  return (f + l).toUpperCase().slice(0, 2);
}

export default function FamilyProfileCard({ person, onOpen }) {
  const photo = person?.photoUrl || person?.photo;
  const subtitle = [person?.birthDate, person?.birthCityCustom || person?.birthCity]
    .filter(Boolean)
    .join(" · ") || "Профиль";

  const open = useCallback(() => {
    onOpen?.(person);
  }, [onOpen, person]);

  return (
    <div className="rel-pc-grid-slot">
      <ProfileCard
        name={fmtNameFirstLast(person)}
        title={subtitle}
        showUserInfo={false}
        avatarUrl={photo ? strId(photo) : ""}
        avatarFallbackSex={person?.sex || ""}
        avatarInitials={initials(person)}
        onShellClick={open}
        enableTilt={false}
        enableMobileTilt={false}
      />
    </div>
  );
}
