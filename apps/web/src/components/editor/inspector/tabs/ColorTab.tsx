import React from "react";
import { ColorGradingSection } from "../";
import { InspectorSection } from "../shell/InspectorSection";
import { BasicColorCorrectionSection } from "../BasicColorCorrectionSection";

export interface ColorTabProps {
  clipId: string;
  showColorGrading: boolean;
}

export const ColorTab: React.FC<ColorTabProps> = ({
  clipId,
  showColorGrading,
}) => {
  return (
    <>
      {showColorGrading && (
        <>
          <InspectorSection
            title="Brightness / Contrast"
            sectionId="basic-color-correction"
            defaultOpen
          >
            <BasicColorCorrectionSection clipId={clipId} />
          </InspectorSection>
          <InspectorSection
            title="Advanced Color Grading"
            sectionId="color-grading"
            defaultOpen={false}
          >
            <ColorGradingSection clipId={clipId} />
          </InspectorSection>
        </>
      )}
    </>
  );
};
