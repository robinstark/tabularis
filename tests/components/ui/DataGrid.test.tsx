import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DataGrid } from "../../../src/components/ui/DataGrid";

vi.mock("../../../src/hooks/useDatabase", () => ({
  useDatabase: () => ({ activeSchema: null, connections: [] }),
}));

vi.mock("../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../../src/hooks/useSettings", () => ({
  useSettings: () => ({ settings: {} }),
}));

vi.mock("../../../src/hooks/useRightSidebar", () => ({
  useRightSidebar: () => ({
    isOpen: false,
    activePanel: null,
    rowEditorData: null,
    isPinned: false,
    openRowEditor: vi.fn(),
    updateRowEditorData: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    setActivePanel: vi.fn(),
    togglePin: vi.fn(),
    onChangeRef: { current: null },
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("DataGrid layout", () => {
  it("keeps hidden header tooltips out of scrollable overflow", () => {
    const { container } = render(
      <DataGrid
        columns={["id", "name"]}
        data={[[1, "Alice"]]}
        columnMetadata={[
          {
            name: "id",
            data_type: "integer",
            is_pk: true,
            is_nullable: false,
            is_auto_increment: false,
          },
          {
            name: "name",
            data_type: "character varying(255)",
            is_pk: false,
            is_nullable: false,
            is_auto_increment: false,
          },
        ]}
        selectedRows={new Set()}
        onSelectionChange={vi.fn()}
        readonly
      />,
    );

    const table = container.querySelector("table");
    const tooltips = container.querySelectorAll('[role="tooltip"]');

    expect(table).toHaveClass("w-full");
    expect(tooltips).toHaveLength(2);
    expect(tooltips[0]).toHaveClass("hidden", "left-0");
    expect(tooltips[1]).toHaveClass("hidden", "right-0");
    expect(tooltips[1]).not.toHaveClass("left-0");
  });

  it("transposes rows and columns when toggled", () => {
    render(
      <DataGrid
        columns={["id", "name"]}
        data={[[1, "Alice"], [2, "Bob"]]}
        readonly
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "dataGrid.transposeView" }),
    );

    expect(screen.getByRole("columnheader", { name: "id" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "2" })).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("highlights the source row as a column and preserves JSON syntax colors", () => {
    render(
      <DataGrid
        columns={["payload"]}
        data={[[{ active: true }], [{ active: false }]]}
        columnMetadata={[
          {
            name: "payload",
            data_type: "json",
            is_pk: false,
            is_nullable: false,
            is_auto_increment: false,
          },
        ]}
        readonly
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "dataGrid.transposeView" }),
    );
    const [firstJsonKey] = screen.getAllByText('"active"');
    fireEvent.click(firstJsonKey);

    expect(firstJsonKey.closest("td")).toHaveClass(
      "bg-blue-900/20",
    );
    expect(firstJsonKey).toHaveAttribute("data-token", "key");
  });

  it("highlights the displayed column when transposed", () => {
    const { container } = render(
      <DataGrid columns={["id"]} data={[[1]]} readonly />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "dataGrid.transposeView" }),
    );

    const bodyRow = container.querySelector("tbody tr");
    const dataCell = bodyRow?.querySelector("td");

    expect(bodyRow).not.toHaveClass("hover:bg-surface-secondary/50");
    fireEvent.mouseEnter(dataCell!);
    expect(dataCell).toHaveClass("bg-surface-secondary/50");
    expect(screen.getByRole("columnheader", { name: "1" })).toHaveClass(
      "bg-surface-secondary",
    );
  });

  it("only renders a bounded window of rows when transposed", () => {
    const { container } = render(
      <DataGrid
        columns={["id", "name"]}
        data={Array.from({ length: 100 }, (_, index) => [index, `Row ${index}`])}
        readonly
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "dataGrid.transposeView" }),
    );

    expect(container.querySelectorAll("tbody td").length).toBeLessThanOrEqual(
      44,
    );
  });

  it("resizes transposed columns and rows for the current grid session", () => {
    render(<DataGrid columns={["id"]} data={[[1]]} readonly />);

    fireEvent.click(
      screen.getByRole("button", { name: "dataGrid.transposeView" }),
    );

    const columnHandle = document.querySelector(
      '[data-transposed-column-resize="0"]',
    )!;
    fireEvent.mouseDown(columnHandle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 140 });
    fireEvent.mouseUp(window);

    expect(screen.getByRole("columnheader", { name: "1" })).toHaveStyle(
      { width: "200px" },
    );

    const rowHandle = document.querySelector(
      '[data-transposed-row-resize="0"]',
    )!;
    fireEvent.mouseDown(rowHandle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 120 });
    fireEvent.mouseUp(window);

    expect(screen.getByText("id").closest("tr")).toHaveStyle({
      height: "55px",
    });
  });
});
