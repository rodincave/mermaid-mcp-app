declare module "mermaid" {
  interface MermaidConfig {
    startOnLoad?: boolean;
    theme?: string | "default" | "forest" | "dark" | "neutral" | "base";
    securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
    [key: string]: any;
  }

  interface RenderResult {
    svg: string;
    bindFunctions?: (element: Element) => void;
  }

  const mermaid: {
    initialize(config: MermaidConfig): void;
    render(id: string, text: string, cb?: (svgCode: string, bindFunctions?: (element: Element) => void) => void): Promise<RenderResult>;
    parse(text: string): Promise<boolean>;
    [key: string]: any;
  };

  export default mermaid;
}
