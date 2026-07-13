'use client';

interface MotorDiagramProps {
  motor?: unknown;
}

export default function MotorDiagram({ motor }: MotorDiagramProps) {
  return (
    <div className="p-4 border border-[#1E212A] rounded">
      Motor Diagram
    </div>
  );
}