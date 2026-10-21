import React from "react";

const steps = ["Giỏ hàng", "Thanh toán", "Trạng thái đơn hàng"];

const CartSteps = ({
  currentStep,
  highestStep,
  onStepChange,
  locked = false,
}) => {
  return (
    <div className="mb-12 flex items-start justify-center">
      {steps.map((label, index) => {
        const step = index + 1;
        const completed = currentStep > step;
        const active = currentStep === step;

        const disabled = step > highestStep || locked;

        return (
          <React.Fragment key={label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStepChange(step)}
              className="flex w-24 flex-col items-center disabled:cursor-default"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                  completed || active
                    ? "border-secondary bg-secondary text-white"
                    : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {completed ? "\u2713" : step}
              </span>

              <span
                className={`mt-2 text-center text-xs sm:text-sm ${
                  completed || active
                    ? "font-semibold text-gray-900"
                    : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </button>

            {step < steps.length && (
              <div
                className={`mt-5 h-[2px] w-10 sm:w-24 ${
                  currentStep > step ? "bg-secondary" : "bg-gray-300"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default CartSteps;
