import React from "react";
import UploadModal from "@/components/upload/UploadModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";

const UserModals = ({
  currentUser,
  isUploadOpen,
  onUploadClose,
  isLoginOpen,
  onLoginClose,
  isRegisterOpen,
  onRegisterClose,
}) => {
  return (
    <>
      <UploadModal
        isOpen={isUploadOpen}
        onClose={onUploadClose}
        currentUser={currentUser}
      />
      <LoginModal isOpen={isLoginOpen} onClose={onLoginClose} />
      <RegisterModal isOpen={isRegisterOpen} onClose={onRegisterClose} />
    </>
  );
};

export default UserModals;
