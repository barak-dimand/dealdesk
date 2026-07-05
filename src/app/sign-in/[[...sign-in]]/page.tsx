import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1]">
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#2f5d50] flex items-center justify-center">
            <div className="w-[13px] h-[13px] bg-white rotate-45 rounded-[3px]" />
          </div>
          <span className="text-[17px] font-bold tracking-[-0.02em] text-[#23211d]">
            Dealdesk
          </span>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
