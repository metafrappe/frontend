import { Table as TableIcon } from '@phosphor-icons/react';
import { Table } from 'antd';

import type { TableBlock, TableCell } from '../types';

export function TableView({ block }: { block: TableBlock }) {
  // The row key column is always an ID. The others are descriptions and wrap.
  const columns = block.columns.map((column) => {
    const kind = column.key === block.rowKey ? 'id' : (column.kind ?? 'text');
    return {
      key: column.key,
      dataIndex: column.key,
      title: column.title,
      className: kind === 'id' ? 'genui-cell-id' : 'genui-cell-text',
      // A table cell ignores max-width. The limit sits on the inner box.
      ...(kind === 'text'
        ? { render: (value: TableCell) => <span className="genui-wrap">{value}</span> }
        : {}),
    };
  });
  return (
    <section data-genui="table" className="genui-card">
      <header className="genui-card-h">
        <TableIcon aria-hidden />
        <strong>{block.title}</strong>
        <span className="genui-muted">{block.rows.length} satır</span>
      </header>
      {/* The table scrolls horizontally in its own container. The page does not overflow. */}
      <div className="genui-table-scroll">
        <Table<Record<string, TableCell>>
          size="small"
          pagination={false}
          rowKey={(row) => String(row[block.rowKey])}
          columns={columns}
          dataSource={block.rows}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </section>
  );
}
