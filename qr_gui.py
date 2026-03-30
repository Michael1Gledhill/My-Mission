"""
A simple PySide6 GUI for generating QR codes.
"""
import sys
from pathlib import Path
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QFileDialog, QMessageBox, QColorDialog, QComboBox, QSpinBox
)
from PySide6.QtGui import QPixmap, QImage, QColor
from PySide6.QtCore import Qt

try:
    import qrcode
    from qrcode.constants import (
        ERROR_CORRECT_H, ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q
    )
except ImportError:
    QMessageBox.critical(None, "Missing Dependency", "Install qrcode[pil] first!\n\npip install qrcode[pil]")
    sys.exit(1)

ERROR_CORRECTION_MAP = {
    "L": ERROR_CORRECT_L,
    "M": ERROR_CORRECT_M,
    "Q": ERROR_CORRECT_Q,
    "H": ERROR_CORRECT_H,
}

def build_qr_image(data, version=1, error_correction="L", box_size=10, border=4, fill_color="black", back_color="white"):
    correction = ERROR_CORRECTION_MAP.get(error_correction.upper(), ERROR_CORRECT_L)
    qr = qrcode.QRCode(
        version=version,
        error_correction=correction,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color=fill_color, back_color=back_color)

class QRCodeGUI(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("QR Code Generator")
        self.setMinimumWidth(420)
        layout = QVBoxLayout()

        # Input
        self.input_label = QLabel("Text or URL:")
        self.input_edit = QLineEdit()
        layout.addWidget(self.input_label)
        layout.addWidget(self.input_edit)

        # Output file
        file_layout = QHBoxLayout()
        self.file_edit = QLineEdit("qr.png")
        self.browse_btn = QPushButton("Browse...")
        self.browse_btn.clicked.connect(self.browse_file)
        file_layout.addWidget(QLabel("Output file:"))
        file_layout.addWidget(self.file_edit)
        file_layout.addWidget(self.browse_btn)
        layout.addLayout(file_layout)

        # Color pickers
        color_layout = QHBoxLayout()
        self.fg_color = QColor("black")
        self.bg_color = QColor("white")
        self.fg_btn = QPushButton("QR Color")
        self.bg_btn = QPushButton("Background Color")
        self.fg_btn.clicked.connect(self.pick_fg_color)
        self.bg_btn.clicked.connect(self.pick_bg_color)
        color_layout.addWidget(self.fg_btn)
        color_layout.addWidget(self.bg_btn)
        layout.addLayout(color_layout)

        # Error correction and box size
        opts_layout = QHBoxLayout()
        opts_layout.addWidget(QLabel("Error Correction:"))
        self.ec_combo = QComboBox()
        self.ec_combo.addItems(["L", "M", "Q", "H"])
        opts_layout.addWidget(self.ec_combo)
        opts_layout.addWidget(QLabel("Box Size:"))
        self.box_spin = QSpinBox()
        self.box_spin.setRange(1, 40)
        self.box_spin.setValue(10)
        opts_layout.addWidget(self.box_spin)
        layout.addLayout(opts_layout)

        # Generate button
        self.gen_btn = QPushButton("Generate QR Code")
        self.gen_btn.clicked.connect(self.generate_qr)
        layout.addWidget(self.gen_btn)

        # QR code preview
        self.qr_label = QLabel()
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.qr_label.setMinimumSize(220, 220)
        layout.addWidget(self.qr_label)

        self.setLayout(layout)

    def pick_fg_color(self):
        color = QColorDialog.getColor(self.fg_color, self, "Select QR Color")
        if color.isValid():
            self.fg_color = color
            self.fg_btn.setStyleSheet(f"background: {color.name()}; color: white;")

    def pick_bg_color(self):
        color = QColorDialog.getColor(self.bg_color, self, "Select Background Color")
        if color.isValid():
            self.bg_color = color
            self.bg_btn.setStyleSheet(f"background: {color.name()}; color: black;")

    def browse_file(self):
        fname, _ = QFileDialog.getSaveFileName(self, "Save QR Code", self.file_edit.text(), "PNG Files (*.png);;All Files (*)")
        if fname:
            self.file_edit.setText(fname)

    def generate_qr(self):
        text = self.input_edit.text().strip()
        if not text:
            QMessageBox.warning(self, "Input Required", "Please enter text or a URL to encode.")
            return
        out_path = self.file_edit.text().strip() or "qr.png"
        fg = self.fg_color.name()
        bg = self.bg_color.name()
        ec = self.ec_combo.currentText()
        box_size = self.box_spin.value()
        try:
            img = build_qr_image(
                text,
                error_correction=ec,
                box_size=box_size,
                fill_color=fg,
                back_color=bg,
            )
            pil_img = img.get_image().convert("RGB")
            pil_img.save(out_path)
            # Show preview, always fit nicely
            preview_size = 220
            img_bytes = pil_img.tobytes("raw", "RGB")
            w, h = pil_img.size
            qimg = QImage(img_bytes, w, h, QImage.Format.Format_RGB888)
            pixmap = QPixmap.fromImage(qimg)
            self.qr_label.setPixmap(pixmap.scaled(
                preview_size, preview_size,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation
            ))
            QMessageBox.information(self, "Success", f"QR code saved to:\n{out_path}")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to generate QR code:\n{e}")

def main():
    app = QApplication(sys.argv)
    win = QRCodeGUI()
    win.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
