"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import UserInteractionsModal from "./UserInteractionsModal";

interface UserInteractionsButtonProps {
  userLogin: string;
  userGithubId: number;
  companyName: string;
  interactionCount: number;
  isMaintainer?: boolean | null;
}

export default function UserInteractionsButton({
  userLogin,
  userGithubId,
  companyName,
  interactionCount,
  isMaintainer,
}: UserInteractionsButtonProps) {
  const [showModal, setShowModal] = useState(false);

  if (interactionCount === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`ml-2 text-sm transition-colors ${
          isMaintainer
            ? "text-gray-400 hover:text-gray-600"
            : "text-blue-500 hover:text-blue-700"
        }`}
        title="View interaction details"
      >
        <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4" />
      </button>
      {showModal && (
        <UserInteractionsModal
          userLogin={userLogin}
          userGithubId={userGithubId}
          companyName={companyName}
          interactionCount={interactionCount}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
